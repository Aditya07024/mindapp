import mongoose from "mongoose";
import { Subscription } from "../models/subscription";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const subs = await Subscription.find().sort({ createdAt: -1 }).limit(5);
  console.log(JSON.stringify(subs, null, 2));
  await mongoose.disconnect();
}
run();
