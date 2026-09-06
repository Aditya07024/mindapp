import { env } from "@/config/env";
import { createApp } from "@/app";
import SubscriptionService from "@/services/subscription.service";

createApp()
  .then((app) => {
    app.listen(Number(env.PORT), () => {
      console.log(`MyMindTherapyFriend API running on ${env.PORT}`);

      // Background Cron Job: Runs every 5 minutes to keep server active & sync Razorpay subscriptions
      setInterval(async () => {
        try {
          console.log("[CronJob] Executing periodic subscription sync...");
          const res = await SubscriptionService.syncAllSubscriptions();
          console.log(`[CronJob] Sync finished. Processed: ${res.processed}, Activated: ${res.activated}, Expired: ${res.expired}`);
        } catch (err) {
          console.error("[CronJob] Subscription sync error:", err);
        }
      }, 5 * 60 * 1000);
    });
  })
  .catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
