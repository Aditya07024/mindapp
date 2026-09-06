import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface INotification extends Document {
  userId: string;
  title: string;
  body: string;
  type: "booking" | "approval" | "crisis_alert" | "system";
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: String, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ["booking", "approval", "crisis_alert", "system"],
      required: true,
      index: true
    },
    read: { type: Boolean, default: false, index: true },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export const Notification = mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
