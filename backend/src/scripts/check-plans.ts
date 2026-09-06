import mongoose from "mongoose";
import { SubscriptionPlan } from "../models/subscription-plan";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const plans = await SubscriptionPlan.find();
  console.log(JSON.stringify(plans, null, 2));
  await mongoose.disconnect();
}
run();
