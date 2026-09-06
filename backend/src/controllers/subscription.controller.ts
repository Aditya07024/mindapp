import type { Request, Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { User, TherapistBooking, Subscription } from "@/models";
import { AppError } from "@/lib/app-error";
import SubscriptionService from "@/services/subscription.service";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  mann_shanti: "Mann Shanti",
  apna_therapist: "Apna Therapist",
};

export class SubscriptionController {
  /** GET /subscription — get current user's tier + usage */
  static getMySubscription = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const user = await User.findById(req.user!.sub).lean();
      if (!user) throw new AppError("User not found", 404);

      // Look for active personal subscription first
      let sub = await Subscription.findOne({
        userId: req.user!.sub,
        status: "active",
      })
        .sort({ createdAt: -1 })
        .lean();

      // If no personal active sub, check for an active organization-level sub
      if (!sub && user.orgId) {
        const orgSub = await Subscription.findOne({
          orgId: user.orgId,
          status: "active",
        })
          .sort({ createdAt: -1 })
          .lean();
        
        if (orgSub) {
          sub = orgSub;
        }
      }

      // If no active subscription is found, look for any pending subscription to display in the UI metadata
      let displaySub = sub;
      if (!displaySub) {
        const pendingQuery: any = { status: "pending" };
        if (user.orgId) {
          pendingQuery.$or = [{ userId: req.user!.sub }, { orgId: user.orgId }];
        } else {
          pendingQuery.userId = req.user!.sub;
        }
        displaySub = await Subscription.findOne(pendingQuery)
          .sort({ createdAt: -1 })
          .lean();
      }

      // If pending, auto-check Razorpay API status
      if (displaySub && displaySub.status === "pending" && displaySub.razorpaySubscriptionId) {
        try {
          const razorpaySub = await SubscriptionService.getSubscriptionDetails(displaySub.razorpaySubscriptionId);
          const isPaidCountPositive = typeof (razorpaySub as any).paid_count === "number" && (razorpaySub as any).paid_count > 0;
          let isPaid = ["active", "authenticated", "completed"].includes(razorpaySub.status) || isPaidCountPositive;

          if (!isPaid) {
            try {
              const Razorpay = (await import("razorpay")).default;
              const key_id = process.env.RAZORPAY_KEY_ID;
              const key_secret = process.env.RAZORPAY_KEY_SECRET;
              if (key_id && key_secret) {
                const rzp = new Razorpay({ key_id, key_secret });
                const invoices = await rzp.invoices.all({ subscription_id: displaySub.razorpaySubscriptionId } as any);
                if (invoices?.items?.some((inv: any) => inv.status === "paid")) {
                  isPaid = true;
                }
              }
            } catch (invErr) {}
          }

          if (isPaid) {
            await Subscription.findByIdAndUpdate(displaySub._id, { status: "active" });
            displaySub.status = "active";
            sub = displaySub;
            if (!displaySub.orgId && displaySub.userId) {
              let tier: string | null = SubscriptionService.tierFromPlanId(razorpaySub.plan_id);
              if (tier) {
                await User.findByIdAndUpdate(displaySub.userId, { tier });
              }
            }
          }
        } catch (subCheckErr) {
          console.warn("[getMySubscription] Auto-sync check error:", subCheckErr);
        }
      }

      const isOrgSub = !!(sub && sub.orgId);
      const effectiveTier = sub ? sub.plan : (user.tier || "free");

      // Calculate messages used today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { Conversation } = await import("@/models");
      const userConvs = await Conversation.find({
        userId: req.user!.sub,
        "messages.timestamp": { $gte: today },
      }).lean();
      const messagesUsedToday = userConvs.reduce((sum, conv) => {
        return sum + (conv.messages?.filter(
          (m) => m.role === "user" && new Date(m.timestamp) >= today
        ).length ?? 0);
      }, 0);

      // Fetch plan config if available
      let planConfig: {
        dailyChatLimit: number | null;
        hasPriorityBooking: boolean;
        therapistDiscount: number;
        hasUnlimitedJournal: boolean;
      } = {
        dailyChatLimit: 300,
        hasPriorityBooking: false,
        therapistDiscount: 0,
        hasUnlimitedJournal: false
      };

      if (sub && sub.planId) {
        const { SubscriptionPlan } = await import("@/models");
        const plan = await SubscriptionPlan.findById(sub.planId).lean();
        if (plan?.config) {
          planConfig = plan.config;
        }
      } else {
        // Fallback for legacy hardcoded tiers
        if (effectiveTier === "mann_shanti") {
          planConfig.dailyChatLimit = 100;
        } else if (effectiveTier === "apna_therapist" || isOrgSub) {
          planConfig.dailyChatLimit = null;
        }
      }

      const dailyLimit = planConfig.dailyChatLimit ?? Infinity;

      res.json({
        tier: effectiveTier,
        tierLabel: isOrgSub ? "Organization Premium" : (TIER_LABELS[effectiveTier] ?? effectiveTier),
        config: planConfig, // Send the dynamic config to frontend
        subscription: displaySub
          ? {
              id: displaySub._id,
              plan: displaySub.plan,
              status: displaySub.status,
              startDate: displaySub.startDate,
              endDate: displaySub.endDate,
              razorpaySubscriptionId: displaySub.razorpaySubscriptionId,
              isOrganization: !!displaySub.orgId,
            }
          : null,
        usage: {
          messagesUsedToday,
          dailyLimit: Number.isFinite(dailyLimit) ? dailyLimit : null,
          messagesRemainingToday: Number.isFinite(dailyLimit)
            ? Math.max(0, (dailyLimit as number) - messagesUsedToday)
            : null,
        },
      });
    },
  );

  /** POST /subscription/upgrade — create Razorpay recurring subscription */
  static upgradeSubscription = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      try {
        const { tier } = req.body;
        console.log(`[Upgrade] Initiating upgrade for user ${req.user!.sub} to tier ${tier}`);
        
        const user = await User.findById(req.user!.sub).lean();
        if (!user) throw new AppError("User not found", 404);

        let finalTier = tier;
        let planName = tier;
        let razorpaySub: any;
        let isOrgPlan = false;
        let durationMonths = 1;

        if (["mann_shanti", "apna_therapist"].includes(tier)) {
          if (user.tier === tier) {
            throw new AppError("Already on this plan", 400);
          }
          const contactInfo = user.phoneMasked || (req.user as any)?.email || "customer@mymindtherapyfriend.com";
          razorpaySub = await SubscriptionService.createSubscription(tier, contactInfo);
        } else {
          // Dynamic Plan Support
          const { SubscriptionPlan } = await import("@/models");
          const dynamicPlan = await SubscriptionPlan.findById(tier);
          if (!dynamicPlan) throw new AppError("Invalid tier or plan ID", 400);

          if (dynamicPlan.audience === "organization") {
            if (user.role !== "org_admin" && user.role !== "super_admin") {
              throw new AppError("Only organization admins can purchase this plan", 403);
            }
            if (!user.orgId) {
              throw new AppError("User is not associated with any organization", 400);
            }
            isOrgPlan = true;
          }

          durationMonths = dynamicPlan.durationMonths || 1;

          // Make sure it has a razorpayPlanId
          if (!dynamicPlan.razorpayPlanId) {
            console.log(`[Upgrade] Creating Razorpay plan for dynamic plan ${dynamicPlan.name}`);
            dynamicPlan.razorpayPlanId = await SubscriptionService.createRazorpayPlan(dynamicPlan.name, dynamicPlan.price, durationMonths);
            await SubscriptionPlan.findByIdAndUpdate(dynamicPlan._id, { razorpayPlanId: dynamicPlan.razorpayPlanId });
          }

          finalTier = dynamicPlan._id.toString();
          planName = dynamicPlan.name;
          // Razorpay requires an email or phone for notifications
          const contactInfo = user.phoneMasked || (req.user as any)?.email || "customer@mymindtherapyfriend.com";

          try {
            razorpaySub = await SubscriptionService.createDynamicSubscription(
              dynamicPlan.razorpayPlanId,
              dynamicPlan.name,
              contactInfo,
              durationMonths
            );
          } catch (err: any) {
            // If the stored plan ID is invalid (e.g. from a different account), clear it and retry once
            if (err.error?.description?.includes("invalid") || err.error?.code === "BAD_REQUEST_ERROR") {
              console.log(`[Upgrade] Stale Razorpay Plan ID detected (${dynamicPlan.razorpayPlanId}). Recreating...`);
              dynamicPlan.razorpayPlanId = await SubscriptionService.createRazorpayPlan(dynamicPlan.name, dynamicPlan.price, durationMonths);
              await SubscriptionPlan.findByIdAndUpdate(dynamicPlan._id, { razorpayPlanId: dynamicPlan.razorpayPlanId });
              
              razorpaySub = await SubscriptionService.createDynamicSubscription(
                dynamicPlan.razorpayPlanId,
                dynamicPlan.name,
                contactInfo,
                durationMonths
              );
            } else {
              throw err;
            }
          }
        }

        console.log(`[Upgrade] Razorpay subscription created: ${razorpaySub.subscriptionId}`);

        // Save pending subscription record (activated via webhook)
        await Subscription.create({
          userId: req.user!.sub,
          orgId: isOrgPlan ? user.orgId : undefined,
          planId: ["mann_shanti", "apna_therapist"].includes(tier) ? undefined : tier,
          plan: planName,
          status: "pending", // Will be activated via webhook
          razorpaySubscriptionId: razorpaySub.subscriptionId,
          startDate: new Date(),
          endDate: new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000), // N months
        });

        res.json({
          subscriptionId: razorpaySub.subscriptionId,
          shortUrl: razorpaySub.shortUrl,
          tier: finalTier,
          message: "Subscription created. Complete payment to activate.",
        });
      } catch (error: any) {
        console.error("[Upgrade Error]", error);
        if (error instanceof AppError) throw error;
        const errMsg = error.error?.description || error.message || "Failed to create subscription";
        throw new AppError(errMsg, 400);
      }
    },
  );

  /** POST /subscription/cancel — cancel active or pending subscription */
  static cancelSubscription = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const userId = req.user!.sub;

      // Look for active subscription first
      let sub = await Subscription.findOne({
        userId,
        status: "active",
        plan: { $ne: "free" },
      }).sort({ createdAt: -1 });

      // Fallback to pending subscriptions if no active one exists
      if (!sub) {
        const pendingSubs = await Subscription.find({
          userId,
          status: "pending",
          plan: { $ne: "free" },
        });

        if (pendingSubs.length === 0) {
          throw new AppError("No active or pending subscription found", 404);
        }

        for (const pendingSub of pendingSubs) {
          if (pendingSub.razorpaySubscriptionId) {
            try {
              await SubscriptionService.cancelSubscription(
                pendingSub.razorpaySubscriptionId,
              );
            } catch (err) {
              console.warn(
                `[Cancel] Failed to cancel subscription ${pendingSub.razorpaySubscriptionId} on Razorpay (might be unpaid/pending):`,
                err
              );
            }
          }
          pendingSub.status = "cancelled";
          await pendingSub.save();
        }

        // Downgrade user tier to free
        await User.findByIdAndUpdate(userId, { tier: "free" });

        return res.json({ message: "Subscription cancelled successfully." });
      }

      if (sub.razorpaySubscriptionId) {
        try {
          await SubscriptionService.cancelSubscription(
            sub.razorpaySubscriptionId,
          );
        } catch (err) {
          console.warn(
            `[Cancel] Failed to cancel subscription ${sub.razorpaySubscriptionId} on Razorpay (might be unpaid/pending):`,
            err
          );
        }
      }

      sub.status = "cancelled";
      await sub.save();

      // Downgrade user tier to free
      await User.findByIdAndUpdate(userId, { tier: "free" });

      res.json({ message: "Subscription cancelled successfully." });
    },
  );

  /** Process subscription webhook event logic */
  static async processWebhookEvent(event: any) {
    const subId = event?.payload?.subscription?.entity?.id || event?.payload?.invoice?.entity?.subscription_id || event?.payload?.payment?.entity?.subscription_id;
    const planId = event?.payload?.subscription?.entity?.plan_id || event?.payload?.invoice?.entity?.plan_id;

    if (!subId) {
      return;
    }

    const { Subscription, User } = await import("@/models");
    const SubscriptionService = (await import("@/services/subscription.service")).default;

    const sub = await Subscription.findOne({
      razorpaySubscriptionId: subId,
    });

    switch (event.event) {
      case "subscription.authenticated":
      case "subscription.activated":
      case "invoice.paid": {
        if (sub) {
          sub.status = "active";
          await sub.save();
          
          if (!sub.orgId && sub.userId) {
            let tier: string | null = SubscriptionService.tierFromPlanId(planId);
            if (!tier && planId) {
              const { SubscriptionPlan } = await import("@/models");
              const dbPlan = await SubscriptionPlan.findOne({ razorpayPlanId: planId }).lean();
              if (dbPlan) {
                tier = dbPlan.audience === "user" ? "mann_shanti" : "apna_therapist";
              }
            }
            if (tier) {
              await User.findByIdAndUpdate(sub.userId, { tier });
            }
          }
        }
        break;
      }
      case "subscription.cancelled":
      case "subscription.expired": {
        if (sub) {
          sub.status = event.event === "subscription.cancelled" ? "cancelled" : "expired";
          await sub.save();
          if (!sub.orgId && sub.userId) {
            await User.findByIdAndUpdate(sub.userId, { tier: "free" });
          }
        }
        break;
      }
      case "subscription.charged": {
        if (sub) {
          sub.status = "active";
          let durationMonths = 1;
          if (sub.planId) {
            const { SubscriptionPlan } = await import("@/models");
            const dbPlan = await SubscriptionPlan.findById(sub.planId).lean();
            if (dbPlan?.durationMonths) {
              durationMonths = dbPlan.durationMonths;
            }
          }
          sub.endDate = new Date(
            (sub.endDate ?? new Date()).getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000,
          );
          await sub.save();

          if (!sub.orgId && sub.userId) {
            let tier: string | null = SubscriptionService.tierFromPlanId(planId);
            if (!tier && planId) {
              const { SubscriptionPlan } = await import("@/models");
              const dbPlan = await SubscriptionPlan.findOne({ razorpayPlanId: planId }).lean();
              if (dbPlan) {
                tier = dbPlan.audience === "user" ? "mann_shanti" : "apna_therapist";
              }
            }
            if (tier) {
              await User.findByIdAndUpdate(sub.userId, { tier });
            }
          }
        }
        break;
      }
    }
  }

  /** POST /subscription/webhook — Razorpay subscription webhook */
  static webhook = asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers["x-razorpay-signature"] as string;
    const body = JSON.stringify(req.body);

    if (!SubscriptionService.verifyWebhookSignature(body, signature)) {
      throw new AppError("Invalid webhook signature", 400);
    }

    await SubscriptionController.processWebhookEvent(req.body);
    res.json({ received: true });
  });

  /** POST /subscription/demo-activate — create & activate a sub instantly (DEV ONLY) */
  static demoActivate = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      if (process.env.NODE_ENV === "production") {
        throw new AppError("Not allowed in production", 403);
      }

      const userId = req.user!.sub;
      console.log(`[demoActivate] userId=${userId}`);

      const userObj = await User.findById(userId).select("role orgId").lean();
      if (!userObj) throw new AppError("User not found", 404);

      // Find any existing pending sub for this user or their organization
      const query: any = { status: "pending" };
      if (userObj.orgId) {
        query.$or = [{ userId }, { orgId: userObj.orgId }];
      } else {
        query.userId = userId;
      }

      let sub = await Subscription.findOne(query).sort({ createdAt: -1 });
      console.log(`[demoActivate] existing pending sub=${sub?._id ?? "NONE"}`);

      if (sub) {
        sub.status = "active";
        if (userObj.orgId && !sub.orgId) {
          sub.orgId = userObj.orgId;
        }
        await sub.save();
        console.log(`[demoActivate] activated existing pending sub`);
      } else {
        // Check if already active
        const activeQuery: any = { status: "active" };
        if (userObj.orgId) {
          activeQuery.$or = [{ userId }, { orgId: userObj.orgId }];
        } else {
          activeQuery.userId = userId;
        }
        const existing = await Subscription.findOne(activeQuery).sort({ createdAt: -1 });
        console.log(`[demoActivate] existing active sub=${existing?._id ?? "NONE"}`);
        if (existing) {
          // Already active — just make sure tier is set correctly for non-org users
          if (!userObj.orgId) {
            await User.findByIdAndUpdate(userId, { tier: "apna_therapist" });
          }
          return res.json({ message: "Already active", status: "active" });
        }

        // Create a brand new active dev subscription
        sub = await Subscription.create({
          userId,
          orgId: userObj.orgId || undefined,
          plan: userObj.orgId ? "Dev Org Plan" : "Dev Plan",
          status: "active",
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
        console.log(`[demoActivate] created new sub=${sub._id}`);
      }

      // Update user tier to non-free so middleware fallback also passes (only if not an org subscription)
      if (!userObj.orgId) {
        const updateResult = await User.findByIdAndUpdate(userId, { tier: "apna_therapist" }, { new: true }).select("tier _id");
        console.log(`[demoActivate] updated user tier: ${updateResult?.tier} for userId=${updateResult?._id}`);
      }

      // Verify it was actually saved
      const verifyQuery: any = { status: "active" };
      if (userObj.orgId) {
        verifyQuery.$or = [{ userId }, { orgId: userObj.orgId }];
      } else {
        verifyQuery.userId = userId;
      }
      const verifySub = await Subscription.findOne(verifyQuery).lean();
      console.log(`[demoActivate] verify: activeSub=${verifySub?._id ?? "NONE"} status=${verifySub?.status}`);

      res.json({ message: "Subscription activated (Dev Mode)", status: "active" });
    },
  );

  /** GET /subscription/admin/all — Super admin: list all subscriptions */
  static adminListAll = asyncHandler(
    async (_req: AuthedRequest, res: Response) => {
      const subs = await Subscription.find()
        .populate({
          path: "userId",
          select: "fullName role therapistProfile orgId",
          populate: { path: "orgId", select: "name" }
        })
        .populate({
          path: "planId",
          select: "price name config"
        })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      res.json({ subscriptions: subs, total: subs.length });
    },
  );

  /** POST /subscription/sync — sync subscription status with Razorpay */
  static syncSubscription = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const userId = req.user!.sub;

      const userObj = await User.findById(userId).select("orgId").lean();

      // Find the most recent pending or active subscription for this user or their organization
      const query: any = {
        status: { $in: ["pending", "active"] },
      };
      if (userObj?.orgId) {
        query.$or = [{ userId }, { orgId: userObj.orgId }];
      } else {
        query.userId = userId;
      }

      const sub = await Subscription.findOne(query).sort({ createdAt: -1 });

      if (!sub) {
        throw new AppError("No pending or active subscription found to sync.", 404);
      }

      if (!sub.razorpaySubscriptionId) {
        throw new AppError("Subscription has no associated Razorpay ID.", 400);
      }

      try {
        const razorpaySub = await SubscriptionService.getSubscriptionDetails(sub.razorpaySubscriptionId);
        
        const oldStatus = sub.status;
        let newStatus = sub.status;

        const isPaidCountPositive = typeof (razorpaySub as any).paid_count === "number" && (razorpaySub as any).paid_count > 0;
        let isPaid = ["active", "authenticated", "completed"].includes(razorpaySub.status) || isPaidCountPositive;

        if (!isPaid) {
          try {
            // Check if any paid invoice exists on Razorpay for this subscription
            const Razorpay = (await import("razorpay")).default;
            const key_id = process.env.RAZORPAY_KEY_ID;
            const key_secret = process.env.RAZORPAY_KEY_SECRET;
            if (key_id && key_secret) {
              const rzp = new Razorpay({ key_id, key_secret });
              const invoices = await rzp.invoices.all({ subscription_id: sub.razorpaySubscriptionId } as any);
              if (invoices?.items?.some((inv: any) => inv.status === "paid")) {
                isPaid = true;
              }
            }
          } catch (invErr) {
            console.warn("[Subscription Sync] Invoice check error:", invErr);
          }
        }

        if (isPaid) {
          newStatus = "active";
        } else if (["cancelled"].includes(razorpaySub.status)) {
          newStatus = "cancelled";
        } else if (["expired"].includes(razorpaySub.status)) {
          newStatus = "expired";
        }

        sub.status = newStatus;
        await sub.save();

        if (newStatus === "active" && oldStatus !== "active") {
          // Update user's tier if not an org subscription
          if (!sub.orgId && sub.userId) {
            let tier: string | null = null;
            if (razorpaySub.plan_id) {
              tier = SubscriptionService.tierFromPlanId(razorpaySub.plan_id);
              if (!tier) {
                const { SubscriptionPlan } = await import("@/models");
                const dbPlan = await SubscriptionPlan.findOne({ razorpayPlanId: razorpaySub.plan_id }).lean();
                if (dbPlan) {
                  // Dynamic plans use enum fallback, not ObjectId
                  tier = dbPlan.audience === "user" ? "mann_shanti" : "apna_therapist";
                }
              }
            }
            if (tier) {
              await User.findByIdAndUpdate(sub.userId, { tier });
            }
          }
        } else if (newStatus !== "active" && oldStatus === "active") {
          // Downgrade user's tier if it is no longer active
          if (!sub.orgId && sub.userId) {
            await User.findByIdAndUpdate(sub.userId, { tier: "free" });
          }
        }

        res.json({
          status: sub.status,
          razorpayStatus: razorpaySub.status,
          message: `Subscription synced. Status: ${sub.status}`,
        });
      } catch (err: any) {
        console.error("[Subscription Sync Error]", err);
        if (err instanceof AppError) throw err;
        const errMsg = err.error?.description || err.message || "Failed to sync subscription status";
        throw new AppError(errMsg, 400);
      }
    }
  );

  /** GET /subscription/cron-sync — Cron endpoint to sync all subscriptions & keep server alive */
  static cronSync = asyncHandler(
    async (req: Request, res: Response) => {
      const result = await SubscriptionService.syncAllSubscriptions();
      res.json({
        success: true,
        message: "Cron subscription sync completed",
        timestamp: new Date().toISOString(),
        ...result,
      });
    }
  );
}

export default SubscriptionController;
