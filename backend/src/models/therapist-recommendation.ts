import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ITherapistRecommendation extends Document {
  userId: Types.ObjectId;
  therapistIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const TherapistRecommendationSchema = new Schema<ITherapistRecommendation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    therapistIds: [{ type: Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

export const TherapistRecommendation = mongoose.models.TherapistRecommendation || mongoose.model<ITherapistRecommendation>("TherapistRecommendation", TherapistRecommendationSchema);
