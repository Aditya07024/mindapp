import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";
import { AppError } from "@/lib/app-error";
import { OTPService } from "@/services/otp.service";
import { User, type IUser } from "@/models";

export class AuthService {
  static normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    const local =
      digits.startsWith("91") && digits.length === 12
        ? digits.slice(2)
        : digits;

    if (!/^[6-9]\d{9}$/.test(local)) {
      throw new AppError("Invalid Indian phone number", 400);
    }

    return local;
  }

  static hashPhone(phone: string): string {
    return crypto.createHash("sha256").update(phone).digest("hex");
  }

  static maskPhone(phone: string): string {
    return `+91-${phone.slice(0, 2)}xxxxxx${phone.slice(-2)}`;
  }

  static async sendOTP(
    phone: string,
  ): Promise<{ phone: string; expiresInSeconds: number }> {
    const normalizedPhone = this.normalizePhone(phone);
    const mobile = `91${normalizedPhone}`;

    await OTPService.sendOTP(mobile);

    return { phone: normalizedPhone, expiresInSeconds: 300 };
  }

  static generateToken(user: IUser): string {
    const secret = env.JWT_SECRET || "default-secret-key-change-in-production";
    return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, {
      expiresIn: "30d",
    });
  }

  static verifyToken(token: string): { sub: string; role: string } {
    const secret = env.JWT_SECRET || "default-secret-key-change-in-production";
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload & {
      sub: string;
      role: string;
    };
    return {
      sub: decoded.sub,
      role: decoded.role,
    };
  }

  static async verifyOTP(phone: string, otp: string): Promise<IUser> {
    const normalizedPhone = this.normalizePhone(phone);
    const mobile = `91${normalizedPhone}`;

    await OTPService.verifyOTP(mobile, otp);

    return this.findOrCreateUser(normalizedPhone);
  }

  static async findOrCreateUser(phone: string, role: string = "user"): Promise<IUser> {
    const phoneHash = this.hashPhone(phone);
    let user = await User.findOne({ phoneHash });

    if (!user) {
      user = await User.create({
        phoneHash,
        phoneMasked: this.maskPhone(phone),
        role: role as any,
        tier: "free",
        isAnonymous: true,
        verifiedPhoneAt: new Date(),
        onboarding: { concerns: [] },
      });
    } else if (!user.verifiedPhoneAt) {
      user.verifiedPhoneAt = new Date();
      await user.save();
    }

    return user;
  }

  static async getCurrentUser(userId: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user || user.deletedAt) {
      throw new AppError("User not found", 404);
    }
    return user;
  }

  static async updateOnboarding(
    userId: string,
    payload: {
      moodScore?: number;
      concerns?: string[];
      primaryNeed?: "talk" | "tools" | "express";
      completed?: boolean;
    },
  ): Promise<IUser> {
    const user = await this.getCurrentUser(userId);

    user.onboarding = {
      ...user.onboarding,
      ...(payload.moodScore ? { moodScore: payload.moodScore } : {}),
      ...(payload.concerns ? { concerns: payload.concerns } : {}),
      ...(payload.primaryNeed ? { primaryNeed: payload.primaryNeed } : {}),
      ...(payload.completed ? { completedAt: new Date() } : {}),
    };

    user.lastActiveAt = new Date();

    // Sanitize tier: if it contains an invalid value (e.g. ObjectId from old subscription bug), reset to "free"
    const VALID_TIERS = ["free", "mann_shanti", "apna_therapist"];
    if (!VALID_TIERS.includes(user.tier as string)) {
      user.tier = "free" as any;
    }

    await user.save();
    return user;
  }

  static async updateProfile(
    userId: string,
    payload: Record<string, string>,
  ): Promise<IUser> {
    const user = await this.getCurrentUser(userId);

    if (user.role === "therapist") {
      const existingProfile: any = user.therapistProfile;
      const existing = existingProfile && typeof existingProfile.toObject === "function"
        ? existingProfile.toObject()
        : {
            name: "",
            verified: false,
            verificationStatus: "pending",
            specializations: [],
            languages: [],
            sessionFee: 0,
            rating: 0,
            sessionCount: 0,
            availability: [],
          };
      user.therapistProfile = {
        ...existing,
        name: payload["Full name"] ?? existing.name ?? "",
        rciNumber: payload["RCI number"] ?? existing.rciNumber,
        verificationStatus: existing.verificationStatus ?? "pending",
        specializations: payload["Primary specialization"]
          ? [payload["Primary specialization"]]
          : (existing.specializations ?? []),
        languages: payload["Languages"]
          ? payload["Languages"].split(",").map((l: string) => l.trim())
          : (existing.languages ?? []),
        sessionFee: payload["Session fee (₹)"]
          ? Number(payload["Session fee (₹)"])
          : (existing.sessionFee ?? 0),
        bio: payload["Bio"] ?? existing.bio,
        availability: existing.availability ?? [],
      };
    } else if (user.role === "user") {
      if (payload["Full name"]) user.fullName = payload["Full name"];
      if (payload["Preferred language"])
        user.language = payload["Preferred language"];
      if (payload["Location"]) user.location = payload["Location"];
      if (payload["Emergency contact"])
        user.emergencyContact = payload["Emergency contact"];
    } else {
      // org_admin, super_admin
      if (payload["Full name"]) user.fullName = payload["Full name"];
    }

    user.lastActiveAt = new Date();

    // Sanitize tier: if it contains an invalid value (e.g. ObjectId from old subscription bug), reset to "free"
    const VALID_TIERS = ["free", "mann_shanti", "apna_therapist"];
    if (!VALID_TIERS.includes(user.tier as string)) {
      user.tier = "free" as any;
    }

    await user.save();
    return user;
  }

  static async setRole(
    userId: string,
    role: "user" | "therapist" | "org_admin" | "super_admin",
  ): Promise<IUser> {
    const user = await this.getCurrentUser(userId);
    user.role = role;
    await user.save();
    return user;
  }
}
