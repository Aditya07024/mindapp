import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { AIService } from "@/services/ai.service";

export class ChatController {
  static sendMessage = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { message, stream } = req.body;
    const quota = await AIService.ensureChatQuota(req.user!.sub);

    // If client explicitly requests non-streaming response (e.g., mobile client with fetch constraints)
    if (stream === false) {
      let fullReply = "";
      for await (const chunk of AIService.streamReply(req.user!.sub, message)) {
        fullReply += chunk;
      }
      return res.json({ reply: fullReply, remaining: quota.remaining });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      for await (const chunk of AIService.streamReply(req.user!.sub, message)) {
        res.write(`data: ${JSON.stringify({ chunk, remaining: quota.remaining })}\n\n`);
      }
    } catch (err) {
      console.error("Chat streaming error:", err);
      res.write(`data: ${JSON.stringify({ chunk: "I am right here with you. Can you tell me a little more about how you're feeling right now?", remaining: quota.remaining })}\n\n`);
    }

    res.write("data: {\"done\":true}\n\n");
    res.end();
  });


  static getConversationHistory = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const history = await AIService.getConversationHistory(req.user!.sub);
    res.json(history);
  });
}
