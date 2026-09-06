import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ISharedReport extends Document {
  userId: Types.ObjectId;
  therapistId: Types.ObjectId;
  period: "day" | "week" | "fortnight" | "month";
  startDate: Date;
  endDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SharedReportSchema = new Schema<ISharedReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    therapistId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    period: { type: String, enum: ["day", "week", "fortnight", "month"], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    notes: { type: String }
  },
  { timestamps: true }
);

SharedReportSchema.index({ userId: 1, therapistId: 1, createdAt: -1 });

export const SharedReport = mongoose.models.SharedReport || mongoose.model<ISharedReport>("SharedReport", SharedReportSchema);
