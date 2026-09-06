import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ISubscription extends Document {
  userId?: Types.ObjectId;
  orgId?: Types.ObjectId;
  planId?: Types.ObjectId; // Link to SubscriptionPlan
  plan: string; // Plan name (historical record)
  status: "pending" | "active" | "cancelled" | "expired";
  razorpaySubscriptionId?: string;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan" },
    plan: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "active", "cancelled", "expired"],
      default: "pending"
    },
    razorpaySubscriptionId: { type: String },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date }
  },
  { timestamps: true }
);

export const Subscription = (mongoose.models.Subscription as mongoose.Model<ISubscription>) || mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
