import mongoose, { Schema, type Document, type Types } from "mongoose";

interface IContract {
  start: Date;
  end: Date;
  pepm: number;
}

interface IDepartment {
  name: string;
  userIds: Types.ObjectId[];
}

export interface IJoinRequest {
  userId: Types.ObjectId;
  email?: string;
  phoneMasked?: string;
  fullName?: string;
  status: "pending" | "approved" | "rejected";
  autoApproved: boolean;
  requestedAt: Date;
}

export interface IOrganization extends Document {
  name: string;
  type: string;
  officialEmail?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  website?: string;
  verificationStatus: "pending" | "verified" | "rejected";
  documents?: {
    registrationUrl?: string;
    accreditationUrl?: string;
    governmentIdUrl?: string;
  };
  seats: number;
  contract: IContract;
  ssoDomain?: string;
  departments: IDepartment[];
  /** Email addresses uploaded via Excel — used for auto-approval of join requests */
  allowedEmails: string[];
  /** Join requests from users wanting to link with this org */
  pendingJoinRequests: IJoinRequest[];
  allowExternalTherapists: boolean;
  coverMemberTherapyFees: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    officialEmail: { type: String },
    contactPerson: { type: String },
    phone: { type: String },
    address: { type: String },
    website: { type: String },
    verificationStatus: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
    documents: {
      type: {
        registrationUrl: { type: String },
        accreditationUrl: { type: String },
        governmentIdUrl: { type: String }
      },
      required: false
    },
    seats: { type: Number, required: true, default: 0 },
    contract: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
      pepm: { type: Number, required: true }
    },
    ssoDomain: { type: String },
    departments: [
      {
        _id: false,
        name: { type: String, required: true },
        userIds: [{ type: Schema.Types.ObjectId, ref: "User" }]
      }
    ],
    allowedEmails: { type: [String], default: [] },
    pendingJoinRequests: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        email: { type: String },
        phoneMasked: { type: String },
        fullName: { type: String },
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
        autoApproved: { type: Boolean, default: false },
        requestedAt: { type: Date, default: Date.now }
      }
    ],
    allowExternalTherapists: { type: Boolean, default: false },
    coverMemberTherapyFees: { type: Boolean, default: false },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

export const Organization = (mongoose.models.Organization as mongoose.Model<IOrganization>) || mongoose.model<IOrganization>("Organization", OrganizationSchema);
