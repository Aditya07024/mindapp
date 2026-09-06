import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IDelegatedAccess extends Document {
  email: string;
  name?: string;
  roleTitle?: string;
  canHostMeeting: boolean;
  canViewRegistrations: boolean;
  canManageUsers: boolean;
  canManageTherapists: boolean;
  canManageOrganizations: boolean;
  canViewAnalytics: boolean;
  canManageWorkshopPopup: boolean;
  isFullAdmin: boolean;
  grantedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DelegatedAccessSchema = new Schema<IDelegatedAccess>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, default: "" },
    roleTitle: { type: String, default: "Delegated Admin" },
    canHostMeeting: { type: Boolean, default: false },
    canViewRegistrations: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canManageTherapists: { type: Boolean, default: false },
    canManageOrganizations: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: false },
    canManageWorkshopPopup: { type: Boolean, default: false },
    isFullAdmin: { type: Boolean, default: false },
    grantedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const DelegatedAccess =
  (mongoose.models.DelegatedAccess as mongoose.Model<IDelegatedAccess>) ||
  model<IDelegatedAccess>("DelegatedAccess", DelegatedAccessSchema);
