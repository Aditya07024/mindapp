import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IPopupAnnouncement extends Document {
  title: string;
  badgeText: string;
  description: string;
  dateText?: string;
  posterUrl?: string | null;
  conferenceUrl: string;
  conferenceId?: Types.ObjectId | null;
  buttonText: string;
  isActive: boolean;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PopupAnnouncementSchema = new Schema<IPopupAnnouncement>(
  {
    title: { type: String, required: true, trim: true, default: "Upcoming Workshop Announcement" },
    badgeText: { type: String, default: "Live Workshop", trim: true },
    description: {
      type: String,
      required: true,
      default: "Join our upcoming live interactive workshop with mental health experts.",
    },
    dateText: { type: String, default: "Coming Soon", trim: true },
    posterUrl: { type: String, default: null },
    conferenceUrl: { type: String, default: "/conferences", trim: true },
    conferenceId: { type: Schema.Types.ObjectId, ref: "Conference", default: null },
    buttonText: { type: String, default: "Go to Conference Page", trim: true },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const PopupAnnouncement =
  (mongoose.models.PopupAnnouncement as mongoose.Model<IPopupAnnouncement>) ||
  model<IPopupAnnouncement>("PopupAnnouncement", PopupAnnouncementSchema);
