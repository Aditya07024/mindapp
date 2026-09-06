import Razorpay from "razorpay";
import crypto from "crypto";
import { AppError } from "@/lib/app-error";

let _razorpay: Razorpay | null = null;
function getRazorpay() {
  if (_razorpay) return _razorpay;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  
  if (!key_id || !key_secret) {
    throw new AppError("Razorpay API keys are missing. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.", 400);
  }
  
  _razorpay = new Razorpay({ key_id, key_secret });
  return _razorpay;
}

// In-memory cache of plan IDs (seeded from env or created on first use)
const PLAN_CACHE: Record<string, string | undefined> = {
  mann_shanti: process.env.RAZORPAY_PLAN_MANN_SHANTI,
  apna_therapist: process.env.RAZORPAY_PLAN_APNA_THERAPIST,
};

const PLAN_CONFIG = {
  mann_shanti: { amount: 19900, name: "Mann Shanti ₹199/mo", interval: 1, period: "monthly" as const },
  apna_therapist: { amount: 49900, name: "Apna Therapist ₹499/mo", interval: 1, period: "monthly" as const },
};

export class SubscriptionService {
  /** Ensure a Razorpay Plan exists for the tier, create if missing */
  static async getOrCreatePlanId(tier: "mann_shanti" | "apna_therapist"): Promise<string> {
    if (PLAN_CACHE[tier]) return PLAN_CACHE[tier]!;

    const cfg = PLAN_CONFIG[tier];
    try {
      const plan = await getRazorpay().plans.create({
        period: cfg.period,
        interval: cfg.interval,
        item: {
          name: cfg.name,
          amount: cfg.amount,
          currency: "INR",
          description: `MyMindTherapyFriend ${cfg.name} subscription`,
        },
      });

      PLAN_CACHE[tier] = plan.id;
      console.log(`[Subscription] Created Razorpay plan ${plan.id} for tier ${tier}`);
      return plan.id;
    } catch (error) {
      console.error(`[Subscription] Failed to create Razorpay plan for ${tier}:`, error);
      throw error;
    }
  }

  /** Create a Razorpay subscription for a user using an existing Razorpay Plan ID */
  static async createDynamicSubscription(
    razorpayPlanId: string,
    tierName: string,
    userPhone: string,
    durationMonths: number = 1
  ) {
    const isEmail = userPhone.includes("@");
    const notify_info: any = {};
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;

    if (isEmail) {
      notify_info.notify_email = userPhone;
    } else if (phoneRegex.test(userPhone)) {
      notify_info.notify_phone = userPhone;
    } else {
      notify_info.notify_email = "customer@mymindtherapyfriend.com";
    }

    // Number of billing cycles: e.g. 6-month plan -> 12 / 6 = 2 cycles for 1 year
    const total_count = Math.max(1, Math.round(12 / durationMonths));

    try {
      const subscription = await getRazorpay().subscriptions.create({
        plan_id: razorpayPlanId,
        total_count,
        quantity: 1,
        notify_info,
        notes: {
          tier: tierName,
          source: "mymindtherapyfriend_app",
        },
      });

      return {
        subscriptionId: subscription.id,
        shortUrl: (subscription as any).short_url || `https://api.razorpay.com/v1/subscriptions/${subscription.id}/checkout`,
        status: subscription.status,
      };
    } catch (error) {
      console.error("[SubscriptionService] createDynamicSubscription failed:", error);
      throw error;
    }
  }

  /** Ensure a Razorpay Plan exists for the tier, create if missing */
  static async createRazorpayPlan(name: string, amount: number, durationMonths: number = 1) {
    try {
      const plan = await getRazorpay().plans.create({
        period: "monthly",
        interval: durationMonths,
        item: {
          name: name,
          amount: amount * 100, // Convert to paise
          currency: "INR",
          description: `MyMindTherapyFriend ${name} subscription (${durationMonths} months)`,
        },
      });
      console.log(`[Subscription] Created dynamic Razorpay plan ${plan.id} for ${name} (${durationMonths} months)`);
      return plan.id;
    } catch (error) {
      console.error(`[Subscription] Failed to create dynamic Razorpay plan for ${name}:`, error);
      throw error;
    }
  }

  /** Synchronize all pending and active subscriptions with Razorpay and clean expired ones */
  static async syncAllSubscriptions(): Promise<{ processed: number; activated: number; expired: number }> {
    const { Subscription, User } = await import("@/models");
    let processed = 0;
    let activated = 0;
    let expired = 0;

    try {
      // 1. Sync pending/active subscriptions with Razorpay
      const pendingOrActive = await Subscription.find({
        status: { $in: ["pending", "active"] },
        razorpaySubscriptionId: { $exists: true, $ne: "" },
      });

      for (const sub of pendingOrActive) {
        processed++;
        try {
          if (sub.razorpaySubscriptionId) {
            const rzSub = await getRazorpay().subscriptions.fetch(sub.razorpaySubscriptionId);
            const isPaidCountPositive = typeof (rzSub as any).paid_count === "number" && (rzSub as any).paid_count > 0;
            
            let isPaid = ["active", "authenticated", "completed"].includes(rzSub.status) || isPaidCountPositive;
            
            if (!isPaid) {
              try {
                const invoices = await getRazorpay().invoices.all({ subscription_id: sub.razorpaySubscriptionId } as any);
                if (invoices?.items?.some((inv: any) => inv.status === "paid")) {
                  isPaid = true;
                }
              } catch (invErr) {
                // Ignore invoice fetch error
              }
            }

            if (isPaid && sub.status !== "active") {
              sub.status = "active";
              sub.startDate = new Date();
              await sub.save();
              activated++;

              // Update user tier if personal sub
              if (sub.userId && !sub.orgId) {
                let tier: string | null = this.tierFromPlanId(rzSub.plan_id);
                if (!tier && rzSub.plan_id) {
                  const { SubscriptionPlan } = await import("@/models");
                  const dbPlan = await SubscriptionPlan.findOne({ razorpayPlanId: rzSub.plan_id }).lean();
                  if (dbPlan) {
                    tier = dbPlan.audience === "user" ? "mann_shanti" : "apna_therapist";
                  }
                }
                if (tier) {
                  await User.findByIdAndUpdate(sub.userId, { tier });
                }
              }
            } else if (["cancelled", "expired"].includes(rzSub.status) && !isPaid) {
              if (sub.status !== "cancelled") {
                sub.status = "cancelled";
                await sub.save();
                expired++;

                if (sub.userId && !sub.orgId) {
                  await User.findByIdAndUpdate(sub.userId, { tier: "free" });
                }
              }
            }
          }
        } catch (subErr) {
          // Ignore individual fetch errors
        }
      }

      // 2. Check for subscriptions past their end date
      const expiredSubs = await Subscription.find({
        status: "active",
        endDate: { $lt: new Date() },
      });

      for (const sub of expiredSubs) {
        sub.status = "cancelled";
        await sub.save();
        expired++;

        if (sub.userId) {
          await User.findByIdAndUpdate(sub.userId, { tier: "free" });
        }
      }
    } catch (err) {
      console.error("[SubscriptionService] syncAllSubscriptions failed:", err);
    }

    return { processed, activated, expired };
  }

  /** Create a Razorpay subscription for a user */
  static async createSubscription(
    tier: "mann_shanti" | "apna_therapist",
    userPhone: string,
  ) {
    const planId = await this.getOrCreatePlanId(tier);

    const isEmail = userPhone.includes("@");
    const notify_info: any = {};
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;

    if (isEmail) {
      notify_info.notify_email = userPhone;
    } else if (phoneRegex.test(userPhone)) {
      notify_info.notify_phone = userPhone;
    } else {
      notify_info.notify_email = "customer@mymindtherapyfriend.com";
    }

    try {
      const subscription = await getRazorpay().subscriptions.create({
        plan_id: planId,
        total_count: 12, // 12 billing cycles = 1 year
        quantity: 1,
        notify_info,
        notes: {
          tier,
          source: "mymindtherapyfriend_app",
        },
      });

      return {
        subscriptionId: subscription.id,
        shortUrl: (subscription as any).short_url || `https://api.razorpay.com/v1/subscriptions/${subscription.id}/checkout`,
        status: subscription.status,
      };
    } catch (error) {
      console.error("[SubscriptionService] createSubscription failed:", error);
      throw error;
    }
  }

  /** Cancel an active Razorpay subscription */
  static async cancelSubscription(razorpaySubId: string) {
    await getRazorpay().subscriptions.cancel(razorpaySubId);
  }

  /** Fetch details of a Razorpay subscription */
  static async getSubscriptionDetails(razorpaySubId: string) {
    try {
      const subscription = await getRazorpay().subscriptions.fetch(razorpaySubId);
      return subscription;
    } catch (error: any) {
      console.error("[SubscriptionService] getSubscriptionDetails failed:", error);
      const errMsg = error?.error?.description || error?.message || "Failed to fetch Razorpay subscription details";
      throw new AppError(errMsg, 400);
    }
  }

  /** Verify webhook signature from Razorpay */
  static verifyWebhookSignature(body: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return expected === signature;
  }

  /** Map Razorpay plan ID back to our tier */
  static tierFromPlanId(planId: string): "mann_shanti" | "apna_therapist" | null {
    for (const [tier, id] of Object.entries(PLAN_CACHE)) {
      if (id === planId) return tier as "mann_shanti" | "apna_therapist";
    }
    return null;
  }
}

export default SubscriptionService;
