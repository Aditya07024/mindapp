import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IWalletTransaction extends Document {
  userId: Types.ObjectId;
  amount: number;
  type: "credit" | "debit";
  purpose: "add_funds" | "unlock_report" | "book_therapist";
  status: "pending" | "success" | "failed";
  razorpayPaymentLinkId?: string;
  razorpayPaymentId?: string;
  referenceId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    purpose: { type: String, enum: ["add_funds", "unlock_report", "book_therapist"], required: true },
    status: { type: String, enum: ["pending", "success", "failed"], default: "pending", index: true },
    razorpayPaymentLinkId: { type: String },
    razorpayPaymentId: { type: String },
    referenceId: { type: Schema.Types.ObjectId }
  },
  { timestamps: true }
);

export const WalletTransaction =
  (mongoose.models.WalletTransaction as mongoose.Model<IWalletTransaction>) ||
  mongoose.model<IWalletTransaction>("WalletTransaction", WalletTransactionSchema);
