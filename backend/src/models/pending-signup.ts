import mongoose, { Schema, type Document } from "mongoose";

export interface IPendingSignup extends Document {
  username: string;
  email: string;
  passwordHash: string;
  role: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
}

const PendingSignupSchema = new Schema<IPendingSignup>(
  {
    username: { type: String, required: true, lowercase: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "user" },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 600 } // TTL index: automatically deleted after 10 minutes
  },
  { timestamps: true }
);

export const PendingSignup = mongoose.models.PendingSignup || mongoose.model<IPendingSignup>("PendingSignup", PendingSignupSchema);
