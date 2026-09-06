import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IMood extends Document {
  userId: Types.ObjectId;
  score: number;
  tags: string[];
  note?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MoodSchema = new Schema<IMood>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    score: { type: Number, min: 1, max: 10, required: true },
    tags: { type: [String], default: [] },
    note: { type: String },
    date: { type: Date, required: true, default: Date.now }
  },
  { timestamps: true }
);

MoodSchema.index({ userId: 1, date: -1 });

export const Mood = (mongoose.models.Mood as mongoose.Model<IMood>) || mongoose.model<IMood>("Mood", MoodSchema);
