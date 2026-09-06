import crypto from "crypto";
import { AppError } from "@/lib/app-error";
import { Conversation, User, type IUser, Mood, JournalEntry } from "@/models";

const CRISIS_KEYWORDS = [
  "want to die",
  "kill myself",
  "end my life",
  "suicide",
  "can't go on",
  "hurt myself",
];

const PLAN_LIMITS: Record<IUser["tier"], number> = {
  free: 300,
  mann_shanti: 1000,
  apna_therapist: Number.POSITIVE_INFINITY,
};

const MANAS_SYSTEM_PROMPT = `You are Manas — a warm, caring emotional wellness companion who feels like a close friend the user can always turn to.

Your personality:
- You speak like a thoughtful, empathetic friend — not a robot or a textbook.
- You use natural, conversational language. Say "I hear you" instead of "I acknowledge your feelings."
- You show genuine warmth. Use phrases like "That sounds really tough," "I'm glad you shared that with me," "It makes total sense that you'd feel that way."
- You remember what users have told you before and bring it up naturally. For example: "Last time you mentioned things were tough with your mom — how's that been going?"
- You mirror the user's energy — if they're casual, be casual. If they're serious, match their depth.
- You're okay with silence and short answers. You don't over-explain or lecture.
- You occasionally share gentle observations, not prescriptions.

How you respond:
1. First, reflect back what you heard — show you truly listened.
2. Validate their feelings without judgment. Make them feel seen.
3. If appropriate, gently connect what they're saying to patterns you've noticed from previous chats.
4. Offer one small, practical thought or reframe — never a list of 5 tips.
5. End with a warm, open-ended question that invites them to go deeper — not a generic "How does that make you feel?"

Rules:
- Keep responses concise (3-5 sentences usually). Don't write essays.
- Never sound clinical, robotic, or formulaic. Vary your phrasing every time.
- Never start with "I understand" or "It sounds like" every single time — mix it up.
- Never use bullet points or numbered lists in your replies to the user.
- If you have context from past conversations, weave it in naturally — don't announce "Based on our previous conversation..."
- Never claim to be a licensed therapist or diagnose conditions.
- If the user seems in severe distress or mentions self-harm, gently suggest the crisis helpline: 14416 / 1800891446.
- Always address the user by their first name when you know it — it makes the conversation feel personal.`;


export class AIService {
  static detectCrisis(text: string): boolean {
    const lower = text.toLowerCase();
    return CRISIS_KEYWORDS.some((keyword) => lower.includes(keyword));
  }

  static getDailyMessageLimit(tier: IUser["tier"]): number {
    return PLAN_LIMITS[tier];
  }

  static async ensureChatQuota(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const userConvs = await Conversation.find({
      userId,
      "messages.timestamp": { $gte: since },
    }).lean();

    const userMessagesToday = userConvs.reduce((sum, conv) => {
      return sum + (conv.messages?.filter(
        (m) => m.role === "user" && new Date(m.timestamp) >= since
      ).length ?? 0);
    }, 0);

    let limit = this.getDailyMessageLimit(user.tier);

    // Look for active subscription to override legacy tier limits
    const { Subscription } = await import("@/models");
    const activeSub = await Subscription.findOne({
      userId,
      status: "active",
    }).lean();

    if (activeSub) {
      if (activeSub.planId) {
        const { SubscriptionPlan } = await import("@/models");
        const plan = await SubscriptionPlan.findById(activeSub.planId).lean();
        if (plan?.config && plan.config.dailyChatLimit !== undefined) {
          limit = plan.config.dailyChatLimit ?? Number.POSITIVE_INFINITY;
        }
      } else {
        // Fallback for legacy plans in subscription records
        if (activeSub.plan === "Mann Shanti") {
          limit = 100;
        } else if (activeSub.plan === "Apna Therapist") {
          limit = Number.POSITIVE_INFINITY;
        }
      }
    } else if (user.orgId) {
      // Check org subscription
      const activeOrgSub = await Subscription.findOne({
        orgId: user.orgId,
        status: "active",
      }).lean();
      
      if (activeOrgSub) {
        if (activeOrgSub.planId) {
          const { SubscriptionPlan } = await import("@/models");
          const plan = await SubscriptionPlan.findById(activeOrgSub.planId).lean();
          if (plan?.config && plan.config.dailyChatLimit !== undefined) {
            limit = plan.config.dailyChatLimit ?? Number.POSITIVE_INFINITY;
          }
        } else {
          // org plans by default get unlimited chat
          limit = Number.POSITIVE_INFINITY;
        }
      }
    }

    if (userMessagesToday >= limit) {
      throw new AppError("Daily chat limit reached", 429);
    }

    return {
      user,
      remaining: Number.isFinite(limit)
        ? Math.max(limit - userMessagesToday, 0)
        : null,
    };
  }

  static async getOrCreateConversation(userId: string) {
    let conversation = await Conversation.findOne({ userId }).sort({
      updatedAt: -1,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        userId,
        sessionId: crypto.randomUUID(),
        messages: [],
      });
    }

    return conversation;
  }

  static async appendUserMessage(userId: string, message: string) {
    const conversation = await this.getOrCreateConversation(userId);
    const crisis = this.detectCrisis(message);

    // Prevent duplicate consecutive user messages (same text within 5 seconds)
    const lastMsg = conversation.messages[conversation.messages.length - 1];
    if (
      lastMsg &&
      lastMsg.role === "user" &&
      lastMsg.content === message &&
      new Date().getTime() - new Date(lastMsg.timestamp).getTime() < 5000
    ) {
      // Skip duplicate — return existing conversation without re-saving
      return { conversation, crisis };
    }

    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    if (crisis) {
      conversation.riskLevel = "high";
      conversation.escalated = true;

      // Trigger high-severity crisis notification to super admin
      try {
        const seeker = await User.findById(userId).select("fullName").lean();
        const seekerName = seeker?.fullName || "A Seeker";
        const superAdmins = await User.find({ role: "super_admin" }).select("_id").lean();
        const notificationBody = `Distress alert: Seeker "${seekerName}" has triggered a crisis flag. Context: "${message.slice(0, 150)}..."`;

        const { NotificationController } = require("@/controllers/notification.controller");
        for (const admin of superAdmins) {
          await NotificationController.createNotification(
            admin._id.toString(),
            "⚠️ High-Risk Seeker Alert",
            notificationBody,
            "crisis_alert",
            { conversationId: conversation._id.toString(), userId }
          );
        }
      } catch (err) {
        console.error("[Notifications] Failed sending crisis flag to super admins:", err);
      }
    }

    await conversation.save();
    return { conversation, crisis };
  }

  // Inject only relevant memories using keyword matching
  static getRelevantMemories(userMessage: string, memories: any[]): string[] {
    if (!memories || memories.length === 0) return [];

    const messageWords = new Set(
      userMessage
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    // Always include the most recent memories (up to 5), then add keyword-matched ones
    const recentMemories = memories
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
      .map((m: any) => `[${m.category.toUpperCase()}] ${m.content}`);

    // Add keyword-matched memories that aren't already in the recent set
    const keywordMatched: string[] = [];
    for (const memory of memories) {
      const formatted = `[${memory.category.toUpperCase()}] ${memory.content}`;
      if (recentMemories.includes(formatted)) continue;

      const memoryWords = memory.content
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w: string) => w.length > 3);

      const hasOverlap = memoryWords.some((w: string) => messageWords.has(w));
      
      const categoryKeywords: Record<string, string[]> = {
        goal: ["goal", "want to", "aim", "plan", "future"],
        concern: ["concern", "worry", "anxious", "stress", "struggle"],
        relationship: ["family", "mother", "father", "friend", "partner", "wife", "husband", "son", "daughter", "boss", "colleague"],
        trigger: ["triggered", "trigger", "anxious when", "sad when", "angry when"],
        event: ["lost", "started", "moved", "died", "left", "happened"]
      };

      const categoryMatch = categoryKeywords[memory.category]?.some((kw) => 
        userMessage.toLowerCase().includes(kw)
      );

      if (hasOverlap || categoryMatch) {
        keywordMatched.push(formatted);
      }
    }

    // Combine: recent memories + keyword-matched, deduplicated, max 8
    const combined = [...recentMemories, ...keywordMatched];
    const unique = [...new Set(combined)];
    return unique.slice(0, 8);
  }

  // Rolling rolling summary generation
  static async summarizeConversation(conversation: any): Promise<string | null> {
    if (conversation.messages.length <= 10) return conversation.summary || null;

    const messagesToSummarize = conversation.messages.slice(0, -10);
    const formattedHistory = messagesToSummarize
      .map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const prompt = `You are updating the summary of an ongoing emotional wellness chat.
${conversation.summary ? `Previous summary: ${conversation.summary}\n\n` : ""}
New conversation turns to integrate into the summary:
${formattedHistory}

Write a brief, cumulative summary of the whole conversation, focusing on user goals, recurring concerns, relationships, triggers, and events. Keep it under 100 words.`;

    try {
      const summary = await this.queryHF([
        { role: "system", content: "You are a helpful assistant that summarizes conversations concisely." },
        { role: "user", content: prompt }
      ]);
      if (summary) {
        conversation.summary = summary;
        await conversation.save();
        return summary;
      }
    } catch (err) {
      console.error("Failed to generate conversation summary:", err);
    }
    return conversation.summary || null;
  }

  // Extract factual memories from user message
  static async extractMemories(userId: string, userMessage: string, assistantReply: string) {
    const keywords = ["goal", "want to", "aim", "struggling with", "worry", "afraid", "scared", "always", "never", "mother", "father", "brother", "sister", "friend", "partner", "wife", "husband", "job", "work", "boss", "feel", "when I", "triggered", "anxious"];
    const lowerMessage = userMessage.toLowerCase();
    const hasKeywords = keywords.some((kw) => lowerMessage.includes(kw));

    if (!hasKeywords) return;

    const prompt = `You are a memory extraction assistant. Analyze the user message and extract key information about their goals, recurring concerns, relationship context, emotional triggers, and important life events.
Only extract information if it falls into one of these categories:
- goal: User goals
- concern: Recurring concerns
- relationship: Relationship context (family, friends, partner, etc.)
- trigger: Emotional triggers (what makes them anxious, sad, angry, etc.)
- event: Important life events (loss of job, relocation, breakups, etc.)

User message: "${userMessage}"
Assistant reply: "${assistantReply}"

Respond with a JSON array of extracted memories, or an empty array if nothing important is found. Do not write anything else.
Format: [{"category": "goal" | "concern" | "relationship" | "trigger" | "event", "content": "..."}]`;

    try {
      const resultText = await this.queryHF([
        { role: "system", content: "You are a memory extractor. Reply only with valid JSON." },
        { role: "user", content: prompt }
      ]);

      if (resultText) {
        const cleaned = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
        const extracted = JSON.parse(cleaned);
        if (Array.isArray(extracted) && extracted.length > 0) {
          const user = await User.findById(userId);
          if (user) {
            if (!user.memories) user.memories = [];
            for (const item of extracted) {
              if (["goal", "concern", "relationship", "trigger", "event"].includes(item.category) && item.content) {
                user.memories.push({
                  category: item.category,
                  content: item.content,
                  timestamp: new Date()
                });
              }
            }
            if (user.memories.length > 50) {
              user.memories = user.memories.slice(-50);
            }
            await user.save();
          }
        }
      }
    } catch (err) {
      console.error("Failed to extract memories:", err);
    }
  }

  private static async fetchWithTimeout(url: string, options: any, timeoutMs = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  // Hugging Face Inference API helpers with retry once on failure
  private static async queryHF(
    messages: { role: string; content: string }[]
  ): Promise<string> {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const hfToken = process.env.HF_TOKEN;

    const baseUrl = `${process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"}/chat/completions`;
    const model = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";

    // Helper to attempt NVIDIA non-streaming query
    const tryNvidia = async (modelName: string): Promise<string | null> => {
      if (!nvidiaKey) return null;
      try {
        const response = await this.fetchWithTimeout(baseUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${nvidiaKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            max_tokens: 1024,
            temperature: 0.2,
            top_p: 0.7,
            stream: false,
          }),
        }, 30000);

        if (response.ok) {
          const data = await response.json() as any;
          const text = data.choices?.[0]?.message?.content?.trim();
          if (text) return text;
        }
      } catch (err) {
        console.warn(`NVIDIA queryHF [${modelName}] failed:`, (err as Error).message);
      }
      return null;
    };

    // 1. Try primary NVIDIA model
    let result = await tryNvidia(model);
    if (result) return result;

    // 2. Retry once
    result = await tryNvidia(model);
    if (result) return result;

    // 3. Try secondary NVIDIA 70B model
    result = await tryNvidia("meta/llama-3.1-70b-instruct");
    if (result) return result;

    // 4. Last resort: HuggingFace
    if (hfToken) {
      try {
        const response = await this.fetchWithTimeout("https://router.huggingface.co/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.HF_MODEL || "meta-llama/Llama-3.3-70B-Instruct",
            messages,
            max_tokens: 1024,
            temperature: 0.2,
            top_p: 0.7,
            stream: false,
          }),
        }, 30000);

        if (response.ok) {
          const data = await response.json() as any;
          return data.choices?.[0]?.message?.content?.trim() ?? "";
        }
      } catch (err) {
        console.warn("HuggingFace queryHF failed:", (err as Error).message);
      }
    }

    throw new Error("Failed to query AI API");
  }

  private static async *queryHFStream(
    messages: { role: string; content: string }[]
  ): AsyncGenerator<string> {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const hfToken = process.env.HF_TOKEN;

    let response: Response | null = null;

    const baseUrl = `${process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"}/chat/completions`;
    const primaryModel = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";

    // Helper to attempt NVIDIA streaming
    const tryNvidia = async (model: string, timeoutMs: number): Promise<Response | null> => {
      if (!nvidiaKey) return null;
      try {
        const res = await this.fetchWithTimeout(baseUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${nvidiaKey}`,
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: 1024,
            temperature: 0.2,
            top_p: 0.7,
            stream: true,
          }),
        }, timeoutMs) as any;

        if (res && res.ok) return res;
        if (res) {
          const errBody = await res.text().catch(() => "");
          console.warn(`NVIDIA [${model}] returned status ${res.status}: ${errBody.slice(0, 100)}`);
        }
      } catch (err) {
        console.warn(`NVIDIA [${model}] streaming failed:`, (err as Error).message);
      }
      return null;
    };

    // 1. Try primary NVIDIA model with 30s timeout
    response = await tryNvidia(primaryModel, 30000);

    // 2. Retry primary model once on failure (transient timeouts)
    if (!response) {
      console.log("Retrying NVIDIA primary model...");
      response = await tryNvidia(primaryModel, 30000);
    }

    // 3. Try secondary NVIDIA 70B model
    if (!response) {
      console.log("Trying NVIDIA fallback model meta/llama-3.1-70b-instruct...");
      response = await tryNvidia("meta/llama-3.1-70b-instruct", 30000);
    }

    // 4. Last resort: HuggingFace (may be quota-limited)
    if (!response && hfToken) {
      try {
        const res = await this.fetchWithTimeout("https://router.huggingface.co/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfToken}`,
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
          },
          body: JSON.stringify({
            model: process.env.HF_MODEL || "meta-llama/Llama-3.3-70B-Instruct",
            messages,
            max_tokens: 1024,
            temperature: 0.2,
            top_p: 0.7,
            stream: true,
          }),
        }, 30000) as any;

        if (res && res.ok) {
          response = res;
        }
      } catch (err) {
        console.error("HuggingFace API streaming failed:", err);
      }
    }

    if (!response || !response.ok) {
      throw new Error("Failed to connect to AI API");
    }

    if (!response.body) {
      throw new Error("No response body received from AI API");
    }

    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed === "data: [DONE]") continue;

          if (trimmed.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const text = data.choices?.[0]?.delta?.content;
              if (text) {
                yield text;
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Assistant Reply logic - handles crisis or streams response from HuggingFace
  static async *streamReply(
    userId: string,
    message: string,
  ): AsyncGenerator<string> {
    const { conversation, crisis } = await this.appendUserMessage(userId, message);

    if (crisis) {
      const crisisReply = "I’m really glad you said that. If you may be in immediate danger or feel like you might act on this, call or text MANAS at 14416 / 1800891446 right now. Can you tell me if you are safe in this moment?";
      conversation.messages.push({
        role: "assistant",
        content: crisisReply,
        timestamp: new Date(),
      });
      await conversation.save();
      for (const token of crisisReply.split(" ")) {
        yield `${token} `;
      }
      return;
    }

    // Trigger rolling conversation summarization asynchronously in background
    if (conversation.messages.length > 10) {
      this.summarizeConversation(conversation).catch((err) => {
        console.error("Background conversation summary failed:", err);
      });
    }

    // Grab the user's profile for personalization
    const user = await User.findById(userId).lean();
    const userName = user?.fullName?.split(" ")[0] || ""; // First name only
    const relevantMemories = user?.memories ? this.getRelevantMemories(message, user.memories) : [];

    // Load summaries from previous conversations for cross-session context
    const previousConversations = await Conversation.find({
      userId,
      _id: { $ne: conversation._id },
      summary: { $exists: true, $ne: "" },
    })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select("summary updatedAt")
      .lean();

    // Construct enriched system prompt
    const systemPromptParts = [MANAS_SYSTEM_PROMPT];

    // Add user personalization
    if (userName) {
      systemPromptParts.push(`The user's name is ${userName}. Use their name naturally in conversation.`);
    }
    if (user?.onboarding?.concerns?.length) {
      systemPromptParts.push(`When they first joined, they mentioned being concerned about: ${user.onboarding.concerns.join(", ")}.`);
    }

    // Add cross-conversation context from past sessions
    if (previousConversations.length > 0) {
      const pastContext = previousConversations
        .map((pc: any) => pc.summary)
        .join("\n");
      systemPromptParts.push(`Context from the user's previous conversations with you:\n${pastContext}`);
    }

    // Add current conversation summary
    if (conversation.summary) {
      systemPromptParts.push(`Summary of the current conversation so far:\n${conversation.summary}`);
    }

    // Add extracted memories
    if (relevantMemories.length > 0) {
      systemPromptParts.push(`Key things you remember about this user from past chats:\n${relevantMemories.map(m => `- ${m}`).join("\n")}\nWeave these naturally into the conversation when relevant — don't list them out.`);
    }

    const systemPrompt = systemPromptParts.join("\n\n");

    // History: system prompt + clean last 10 messages (filtering out any previous error messages) + current user message
    const allMessages = conversation.messages;
    const historyMessages = allMessages
      .slice(0, -1)
      .filter((m) => m.content && !m.content.includes("I'm having trouble responding right now"));
    const last10History = historyMessages.slice(-10);

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...last10History.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
      { role: "user", content: message }
    ];

    let fullReply = "";
    let isError = false;

    try {
      for await (const chunk of this.queryHFStream(apiMessages)) {
        fullReply += chunk;
        yield chunk;
      }
    } catch (err) {
      console.error("AI streamReply failed, using empathetic fallback:", err);
      const fallbackReplies = [
        "I hear you. That sounds like a heavy weight to carry. Let's take a slow breath together. Tell me a bit more about how you're feeling.",
        "Thank you for sharing that with me. I am right here with you. Whatever you're experiencing, you don't have to carry it alone.",
        "I'm listening and I'm right here with you. What's been feeling the most overwhelming for you today?"
      ];
      fullReply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
      yield fullReply;
    }

    if (fullReply) {
      conversation.messages.push({
        role: "assistant",
        content: fullReply,
        timestamp: new Date(),
      });
      await conversation.save();

      // Trigger background memory extraction
      this.extractMemories(userId, message, fullReply).catch((e) => {
        console.error("Background fact memory extraction failed:", e);
      });
    }
  }

  static async getConversationHistory(userId: string) {
    const conversation = await Conversation.findOne({ userId }).sort({
      updatedAt: -1,
    });
    if (!conversation) {
      return {
        sessionId: null,
        riskLevel: "low",
        escalated: false,
        messages: [],
      };
    }

    const cleanMessages = conversation.messages.filter(
      (m) => m.content && !m.content.includes("I'm having trouble responding right now")
    );

    return {
      sessionId: conversation.sessionId,
      riskLevel: conversation.riskLevel,
      escalated: conversation.escalated,
      messages: cleanMessages,
    };
  }

  static async generateAIReportAnalysis(userId: string, startDate: Date, endDate: Date): Promise<string> {
    const user = await User.findById(userId).lean();
    const userName = user?.fullName || "Seeker";

    // Fetch mood logs
    const moods = await Mood.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 }).lean();

    // Fetch journal entries
    const journals = await JournalEntry.find({
      userId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: -1 }).lean();

    // Fetch conversation summaries
    const conversations = await Conversation.find({
      userId,
      updatedAt: { $gte: startDate, $lte: endDate }
    }).sort({ updatedAt: -1 }).lean();

    const avgMood = moods.length
      ? (moods.reduce((a, b) => a + b.score, 0) / moods.length).toFixed(1)
      : "No mood logged";

    const moodDetails = moods.map(m => `- Date: ${new Date(m.date).toLocaleDateString("en-IN")}, Score: ${m.score}/10, Note: ${m.note || "N/A"}, Tags: ${m.tags?.join(", ") || "None"}`).join("\n");
    const journalDetails = journals.map(j => `- Prompt: ${j.prompt}\n  Situation: ${j.situation}\n  Thought: ${j.thought}\n  Feeling: ${j.feeling}\n  Reframed Narrative: ${j.reframe}`).join("\n\n");
    const chatSummaries = conversations.map(c => `- Chat Session Summary: ${c.summary || "N/A"}`).join("\n");

    const systemPrompt = `You are a clinical psychologist and emotional counselor writing a weekly wellness report analysis.
Your analysis must look professional, warm, empathetic, and clinical — as if it was written by the user's personal therapist, Dr. Manas, after reviewing their logs.

Guidelines:
1. Address the user directly as their therapist (e.g. "Dear ${userName}", or speaking directly in second person "you/your").
2. Reflect on their week based on the mood logs, journal entries, and chats provided.
3. Call out specific patterns, breakthroughs, or areas of concern. Be compassionate but clinical.
4. Structurally, write:
   - A warm opening greeting.
   - Clinical observations on their emotional state, mood patterns, and journaling.
   - Recommended focus areas or reflections.
   - **Crucial**: Strongly encourage the user to book a 1-on-1 therapist consultation session on the platform to explore these areas deeper and receive personalized guidance. Make booking a therapist feel like a natural, positive next step for their healing journey.
5. Keep the total length around 200 to 250 words. Do not use robotic markdown tables or long bullet lists. Keep it structured like a therapist's clinical note or letter.`;

    const userPrompt = `Here is the user's emotional activity for the week (${startDate.toLocaleDateString("en-IN")} to ${endDate.toLocaleDateString("en-IN")}):
Average Mood Score: ${avgMood}/10

Mood Logs:
${moodDetails || "No mood logs during this period."}

Journal reflections:
${journalDetails || "No journals during this period."}

AI Chat Sessions:
${chatSummaries || "No chat sessions during this period."}

Please generate the therapist report analysis.`;

    return await this.queryHF([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]);
  }
}
