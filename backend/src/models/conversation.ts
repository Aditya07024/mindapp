import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface IConversation extends Document {
  userId: Types.ObjectId;
  sessionId: string;
  messages: IMessage[];
  riskLevel: "low" | "medium" | "high";
  escalated: boolean;
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    messages: { type: [MessageSchema], default: [] },
    riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
    escalated: { type: Boolean, default: false },
    summary: { type: String }
  },
  { timestamps: true }
);

ConversationSchema.index({ userId: 1, updatedAt: -1 });

export const Conversation = (mongoose.models.Conversation as mongoose.Model<IConversation>) || mongoose.model<IConversation>("Conversation", ConversationSchema);
