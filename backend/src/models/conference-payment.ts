import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IConferencePayment extends Document {
  conferenceId: Types.ObjectId;
  registrationId: Types.ObjectId;
  userId: Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number;
  currency: string;
  status: "created" | "paid" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const ConferencePaymentSchema = new Schema<IConferencePayment>(
  {
    conferenceId: { type: Schema.Types.ObjectId, ref: "Conference", required: true },
    registrationId: { type: Schema.Types.ObjectId, ref: "ConferenceRegistration", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
  },
  { timestamps: true }
);

ConferencePaymentSchema.index({ razorpayOrderId: 1 });
ConferencePaymentSchema.index({ conferenceId: 1, userId: 1 });

export const ConferencePayment =
  (mongoose.models.ConferencePayment as mongoose.Model<IConferencePayment>) ||
  model<IConferencePayment>("ConferencePayment", ConferencePaymentSchema);
