import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IJournalEntry extends Document {
  userId: Types.ObjectId;
  prompt: string;
  situation: string;
  thought: string;
  feeling: string;
  reframe: string;
  content?: string;
  aiResponse?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    prompt: { type: String, required: true },
    situation: { type: String, required: true },
    thought: { type: String, required: true },
    feeling: { type: String, required: true },
    reframe: { type: String, required: true },
    content: { type: String },
    aiResponse: { type: String },
  },
  { timestamps: true },
);

JournalEntrySchema.index({ userId: 1, createdAt: -1 });

export const JournalEntry =
  (mongoose.models.JournalEntry as mongoose.Model<IJournalEntry>) ||
  mongoose.model<IJournalEntry>("JournalEntry", JournalEntrySchema);
