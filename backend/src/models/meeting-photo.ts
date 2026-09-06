import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IMeetingPhoto extends Document {
  title: string;
  imageUrl: string;
  imageUrls: string[]; // Array of photos for multi-image gallery support
  caption?: string; // Testimonial quote or meeting caption
  speakerName?: string; // Host or participant name
  speakerRole?: string; // Designation e.g. Clinical Psychologist, Engineering Manager
  meetingType?: string; // Tag e.g. Group Therapy, Corporate Workshop, 1-on-1 Session
  attendeeCount?: number; // e.g. 25 attendees
  rating?: number; // 1-5 star rating
  dateText?: string; // e.g. "Aug 2026"
  displayOrder: number;
  isActive: boolean;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingPhotoSchema = new Schema<IMeetingPhoto>(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    imageUrls: { type: [String], default: [] },
    caption: { type: String, default: "", trim: true },
    speakerName: { type: String, default: "", trim: true },
    speakerRole: { type: String, default: "", trim: true },
    meetingType: { type: String, default: "Group Session", trim: true },
    attendeeCount: { type: Number, default: 0 },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    dateText: { type: String, default: "", trim: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);


export const MeetingPhoto =
  (mongoose.models.MeetingPhoto as mongoose.Model<IMeetingPhoto>) ||
  model<IMeetingPhoto>("MeetingPhoto", MeetingPhotoSchema);
