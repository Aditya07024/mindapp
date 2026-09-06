import mongoose, { Schema, type Document } from "mongoose";

export interface ISubscriptionPlan extends Document {
  name: string;
  price: number;
  features: string[];
  audience: "therapist" | "user" | "organization";
  isActive: boolean;
  durationMonths: number;
  config: {
    dailyChatLimit: number | null; // null for unlimited
    hasPriorityBooking: boolean;
    therapistDiscount: number; // percentage
    hasUnlimitedJournal: boolean;
    // Seeker Features
    enableChat: boolean;
    enableTherapistAccess: boolean;
    enableJournaling: boolean;
    enableMoodCheck: boolean;
    enableBreathe: boolean;
    // Therapist Features
    enableScheduling: boolean;
    enableBookings: boolean;
    enableEarnings: boolean;
    enableProfileControl: boolean;
    // Org Features
    enableRosterManagement: boolean;
    enableTherapistAffiliation: boolean;
    enableAnalytics: boolean;
  };
  razorpayPlanId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    features: [{ type: String }],
    audience: {
      type: String,
      enum: ["therapist", "user", "organization"],
      required: true
    },
    isActive: { type: Boolean, default: true },
    durationMonths: { type: Number, default: 1 },
    config: {
      dailyChatLimit: { type: Number, default: 300 },
      hasPriorityBooking: { type: Boolean, default: false },
      therapistDiscount: { type: Number, default: 0 },
      hasUnlimitedJournal: { type: Boolean, default: false },
      // Seeker Features
      enableChat: { type: Boolean, default: true },
      enableTherapistAccess: { type: Boolean, default: true },
      enableJournaling: { type: Boolean, default: true },
      enableMoodCheck: { type: Boolean, default: true },
      enableBreathe: { type: Boolean, default: true },
      // Therapist Features
      enableScheduling: { type: Boolean, default: true },
      enableBookings: { type: Boolean, default: true },
      enableEarnings: { type: Boolean, default: true },
      enableProfileControl: { type: Boolean, default: true },
      // Org Features
      enableRosterManagement: { type: Boolean, default: true },
      enableTherapistAffiliation: { type: Boolean, default: true },
      enableAnalytics: { type: Boolean, default: true }
    },
    razorpayPlanId: { type: String }
  },
  { timestamps: true }
);

export const SubscriptionPlan = (mongoose.models.SubscriptionPlan as mongoose.Model<ISubscriptionPlan>) || mongoose.model<ISubscriptionPlan>("SubscriptionPlan", SubscriptionPlanSchema);
