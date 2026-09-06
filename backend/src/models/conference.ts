import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IConference extends Document {
  title: string;
  description: string;
  banner?: string;
  posterUrl?: string | null;
  roomName: string;
  meetingDate: string; // YYYY-MM-DD
  meetingTime: string; // HH:mm
  duration: number; // in minutes
  category: string;
  meetingType: "public" | "private" | "webinar" | "workshop";
  priceType: "free" | "paid" | "custom";
  price: number;
  maxParticipants: number;
  enableWaitingRoom: boolean;
  enableRecording: boolean;
  enablePassword: boolean;
  password?: string;
  hostEmail?: string;
  hostJoined?: boolean;
  platform: "jitsi" | "teams" | "google_meet";
  meetingLink?: string;
  isRedirectOnly?: boolean;
  endTime?: string;
  instructions?: string;
  status: "draft" | "published" | "upcoming" | "live" | "ended";
  isPinned?: boolean;
  pinnedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConferenceSchema = new Schema<IConference>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    banner: { type: String, default: "" },
    posterUrl: { type: String, default: null },
    roomName: { type: String, required: true, unique: true, trim: true },
    meetingDate: { type: String, required: true },
    meetingTime: { type: String, required: true },
    endTime: { type: String, default: "" },
    platform: {
      type: String,
      enum: ["jitsi", "teams", "google_meet"],
      default: "jitsi",
    },
    meetingLink: { type: String, default: "" },
    isRedirectOnly: { type: Boolean, default: false },
    duration: { type: Number, default: 60 },
    category: { type: String, default: "Mental Health" },
    meetingType: {
      type: String,
      enum: ["public", "private", "webinar", "workshop"],
      default: "public",
    },
    priceType: {
      type: String,
      enum: ["free", "paid", "custom"],
      default: "free",
    },
    price: { type: Number, default: 0 },
    maxParticipants: { type: Number, default: 100 },
    enableWaitingRoom: { type: Boolean, default: false },
    enableRecording: { type: Boolean, default: false },
    enablePassword: { type: Boolean, default: false },
    password: { type: String, default: "" },
    hostEmail: { type: String, default: "", trim: true, lowercase: true },
    hostJoined: { type: Boolean, default: false },
    instructions: { type: String, default: "" },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["draft", "published", "upcoming", "live", "ended"],
      default: "published",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ConferenceSchema.index({ isPinned: -1, pinnedAt: -1, createdAt: -1 });
ConferenceSchema.index({ status: 1, meetingDate: 1 });

export const Conference =
  (mongoose.models.Conference as mongoose.Model<IConference>) ||
  model<IConference>("Conference", ConferenceSchema);
