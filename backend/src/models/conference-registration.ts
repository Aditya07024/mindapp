import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IConferenceRegistration extends Document {
  conferenceId: Types.ObjectId;
  userId: Types.ObjectId;
  fullName: string;
  age: number;
  email: string;
  phone?: string;
  paymentStatus: "free" | "paid" | "pending" | "failed";
  paymentAmount: number;
  joined: boolean;
  joinedAt?: Date;
  joinTime?: Date;
  leaveTime?: Date;
  totalDuration: number; // in minutes
  attendancePercentage: number;
  rejoinCount: number;
  currentStatus: "registered" | "waiting" | "joined" | "left" | "no_show";
  deviceInfo?: string;
  browserInfo?: string;
  ipAddress?: string;
  adminNotes?: string;
  admitted?: boolean;
  admitStatus?: "waiting" | "admitted" | "denied";
  approvalStatus: "approved" | "rejected" | "pending";
  createdAt: Date;
  updatedAt: Date;
}

const ConferenceRegistrationSchema = new Schema<IConferenceRegistration>(
  {
    conferenceId: { type: Schema.Types.ObjectId, ref: "Conference", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fullName: { type: String, required: true, trim: true },
    age: { type: Number, required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true },
    paymentStatus: {
      type: String,
      enum: ["free", "paid", "pending", "failed"],
      default: "free",
    },
    paymentAmount: { type: Number, default: 0 },
    joined: { type: Boolean, default: false },
    joinedAt: { type: Date },
    joinTime: { type: Date },
    leaveTime: { type: Date },
    totalDuration: { type: Number, default: 0 },
    attendancePercentage: { type: Number, default: 0 },
    rejoinCount: { type: Number, default: 0 },
    currentStatus: {
      type: String,
      enum: ["registered", "waiting", "joined", "left", "no_show"],
      default: "registered",
    },
    deviceInfo: { type: String, default: "" },
    browserInfo: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    adminNotes: { type: String, default: "" },
    admitted: { type: Boolean, default: false },
    admitStatus: {
      type: String,
      enum: ["waiting", "admitted", "denied"],
    },
    approvalStatus: {
      type: String,
      enum: ["approved", "rejected", "pending"],
      default: "approved",
    },
  },
  { timestamps: true }
);

ConferenceRegistrationSchema.index({ conferenceId: 1, userId: 1 }, { unique: true });
ConferenceRegistrationSchema.index({ conferenceId: 1, email: 1 });

export const ConferenceRegistration =
  (mongoose.models.ConferenceRegistration as mongoose.Model<IConferenceRegistration>) ||
  model<IConferenceRegistration>("ConferenceRegistration", ConferenceRegistrationSchema);
