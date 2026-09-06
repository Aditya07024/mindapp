import Razorpay from "razorpay";
import { env } from "@/config/env";

export const providerRegistry = {
  razorpay: env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET
      })
    : null,
  hfConfigured: Boolean(env.HF_TOKEN),
  geminiConfigured: Boolean(env.GEMINI_API_KEY),
  livekitConfigured: Boolean(env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_URL),
  r2Configured: false
};
