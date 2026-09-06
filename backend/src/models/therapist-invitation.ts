import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ITherapistInvitation extends Document {
  orgId: Types.ObjectId;
  therapistId: Types.ObjectId;
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const TherapistInvitationSchema = new Schema<ITherapistInvitation>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    therapistId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Ensure a therapist can only have one pending invitation from the same org
TherapistInvitationSchema.index({ orgId: 1, therapistId: 1, status: 1 });

export const TherapistInvitation =
  (mongoose.models.TherapistInvitation as mongoose.Model<ITherapistInvitation>) ||
  mongoose.model<ITherapistInvitation>("TherapistInvitation", TherapistInvitationSchema);
