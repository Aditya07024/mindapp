import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { SubscriptionPlan } from "../models/subscription-plan";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing");
    process.exit(1);
  }
  
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  // 1. Update Apna Mann
  const apnaMann = await SubscriptionPlan.findOne({ name: "Apna Mann", audience: "user" });
  if (apnaMann) {
    apnaMann.price = 199;
    apnaMann.features = [
      "1000 messages/day limit",
      "3 therapist recommendations every week",
      "Weekly therapist clinical evaluation",
      "CBT journal (15 entries in 15 days)",
      "25-day mood calendar",
      "Priority booking + instant access",
      "Buy 1 booking, get 2 free bookings"
    ];
    apnaMann.config = {
      ...apnaMann.config,
      dailyChatLimit: 1000,
      hasPriorityBooking: true,
      hasUnlimitedJournal: false,
      therapistDiscount: 0,
    };
    await apnaMann.save();
    console.log("Updated Apna Mann plan in database.");
  } else {
    console.log("Apna Mann plan not found. Creating it...");
    await SubscriptionPlan.create({
      name: "Apna Mann",
      price: 199,
      features: [
        "1000 messages/day limit",
        "3 therapist recommendations every week",
        "Weekly therapist clinical evaluation",
        "CBT journal (15 entries in 15 days)",
        "25-day mood calendar",
        "Priority booking + instant access",
        "Buy 1 booking, get 2 free bookings"
      ],
      audience: "user",
      isActive: true,
      durationMonths: 1,
      config: {
        dailyChatLimit: 1000,
        hasPriorityBooking: true,
        hasUnlimitedJournal: false,
        therapistDiscount: 0,
        enableChat: true,
        enableTherapistAccess: true,
        enableJournaling: true,
        enableMoodCheck: true,
        enableBreathe: true,
        enableScheduling: true,
        enableBookings: true,
        enableEarnings: true,
        enableProfileControl: true,
        enableRosterManagement: true,
        enableTherapistAffiliation: true,
        enableAnalytics: true
      }
    });
  }

  // 2. Update Mann Shanti
  const mannShanti = await SubscriptionPlan.findOne({ name: "Mann Shanti", audience: "user" });
  if (mannShanti) {
    mannShanti.price = 499;
    mannShanti.features = [
      "Unlimited messages/day",
      "1 therapist recommendation/day",
      "Weekly therapist clinical evaluation",
      "Unlimited journal entries",
      "10% therapist discount",
      "Buy 2 bookings, get 5 free bookings",
      "Unlimited mood calendar/monthly"
    ];
    mannShanti.config = {
      ...mannShanti.config,
      dailyChatLimit: null, // Unlimited
      hasPriorityBooking: true,
      hasUnlimitedJournal: true,
      therapistDiscount: 10,
    };
    await mannShanti.save();
    console.log("Updated Mann Shanti plan in database.");
  } else {
    console.log("Mann Shanti plan not found. Creating it...");
    await SubscriptionPlan.create({
      name: "Mann Shanti",
      price: 499,
      features: [
        "Unlimited messages/day",
        "1 therapist recommendation/day",
        "Weekly therapist clinical evaluation",
        "Unlimited journal entries",
        "10% therapist discount",
        "Buy 2 bookings, get 5 free bookings",
        "Unlimited mood calendar/monthly"
      ],
      audience: "user",
      isActive: true,
      durationMonths: 1,
      config: {
        dailyChatLimit: null,
        hasPriorityBooking: true,
        hasUnlimitedJournal: true,
        therapistDiscount: 10,
        enableChat: true,
        enableTherapistAccess: true,
        enableJournaling: true,
        enableMoodCheck: true,
        enableBreathe: true,
        enableScheduling: true,
        enableBookings: true,
        enableEarnings: true,
        enableProfileControl: true,
        enableRosterManagement: true,
        enableTherapistAffiliation: true,
        enableAnalytics: true
      }
    });
  }

  await mongoose.disconnect();
  console.log("Done updating subscription plans.");
}

run().catch(console.error);
