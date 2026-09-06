import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IAIReport extends Document {
  userId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  paid: boolean;
  amount: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpayPaymentLinkId?: string;
  aiAnalysis?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AIReportSchema = new Schema<IAIReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    paid: { type: Boolean, default: false },
    amount: { type: Number, required: true, default: 29 },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpayPaymentLinkId: { type: String },
    aiAnalysis: { type: String }
  },
  { timestamps: true }
);

AIReportSchema.index({ userId: 1, startDate: -1, endDate: -1 });

export const AIReport = mongoose.models.AIReport || mongoose.model<IAIReport>("AIReport", AIReportSchema);
