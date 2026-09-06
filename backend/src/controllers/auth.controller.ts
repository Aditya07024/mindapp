import type { Request, Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import { AuthService } from "@/services/auth.service";
import type { AuthedRequest } from "@/middleware/auth";
import { User } from "@/models";

function serializeUser(user: any) {
  return {
    id: user._id,
    role: user.role,
    tier: user.tier,
    language: user.language,
    phoneMasked: user.phoneMasked,
    fullName: user.fullName,
    isAnonymous: user.isAnonymous,
    streak: user.streak,
    onboarding: user.onboarding,
    orgId: user.orgId,
    therapistProfile: user.role === "therapist" ? user.therapistProfile : undefined,
  };
}

export class AuthController {
  /** GET /auth/me — returns the current Clerk-authed user's MongoDB profile */
  static me = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const user = await User.findById(req.user!.sub).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(serializeUser(user));
  });

  static updateOnboarding = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { moodScore, concerns, primaryNeed, completed } = req.body;
      const user = await AuthService.updateOnboarding(req.user!.sub, {
        moodScore,
        concerns,
        primaryNeed,
        completed,
      });
      res.json(serializeUser(user));
    },
  );

  static updateProfile = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const user = await AuthService.updateProfile(req.user!.sub, req.body);
      res.json(serializeUser(user));
    },
  );

  static therapistOnboarding = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const {
        fullName,
        qualification,
        experienceCategory,
        specializations,
        clinicDetails,
        degreeUrl,
        licenseUrl,
        governmentIdUrl,
        introVideoUrl,
        orgId,
        location,
        upiId,
        bankDetails,
        email,
        website
      } = req.body;

      const user = await User.findById(req.user!.sub);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (fullName) user.fullName = fullName;
      if (orgId) user.orgId = orgId;
      if (location) user.location = location;

      // Ensure they have the therapist role now, but verification is pending
      user.role = "therapist";

      let sessionFee = 899; // Default
      if (experienceCategory === "5 to 10 yr") sessionFee = 1299;
      else if (experienceCategory === "10 to 15 yr") sessionFee = 1599;
      else if (experienceCategory === "more than 15 yr") sessionFee = 2199;
      
      user.therapistProfile = {
        name: fullName || user.fullName || "",
        email,
        website,
        verified: false,
        verificationStatus: "pending",
        qualification,
        experienceCategory,
        clinicDetails,
        specializations: specializations || [],
        documents: {
          degreeUrl,
          licenseUrl,
          governmentIdUrl,
        },
        introVideoUrl,
        languages: [],
        sessionFee,
        rating: 0,
        sessionCount: 0,
        availability: [],
        paymentDetails: {
          upiId,
          bankDetails
        }
      };

      await user.save();
      res.json(serializeUser(user));
    }
  );
  static setRole = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      let { role } = req.body;

      // Normalize frontend role values
      if (role === "super admin") role = "super_admin";
      if (role === "super-admin") role = "super_admin";
      if (role === "org admin") role = "org_admin";
      if (role === "org-admin") role = "org_admin";

      const validRoles = ["user", "therapist", "org_admin", "super_admin"];

      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const userDoc = await User.findById(req.user!.sub);
      if (!userDoc) {
        return res.status(404).json({ error: "User not found" });
      }

      // SECURITY FIX: If the user already has a defined role (other than 'user'), DO NOT allow it to be changed.
      // This prevents an Org Admin from accidentally becoming a regular user or vice versa if they click the wrong link.
      if (userDoc.role !== "user" && userDoc.role !== role) {
        return res.json({
          message: "Role is already locked for this account.",
          user: serializeUser(userDoc),
        });
      }

      userDoc.role = role;
      await userDoc.save();

      res.json({
        message: `Role confirmed as ${role}`,
        user: serializeUser(userDoc),
      });
    },
  );

  /** POST /auth/push-token — register an Expo push token for this user */
  static registerPushToken = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { token } = req.body;

      if (!token || typeof token !== "string" || !token.startsWith("ExponentPushToken[")) {
        return res.status(400).json({ error: "Invalid Expo push token" });
      }

      // $addToSet prevents duplicate tokens
      await User.findByIdAndUpdate(req.user!.sub, {
        $addToSet: { expoPushTokens: token },
      });

      console.log(`[Auth] Registered push token for user ${req.user!.sub}: ${token}`);
      res.json({ success: true });
    }
  );

  static deleteProfile = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const userId = req.user!.sub;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      user.deletedAt = new Date();
      await user.save();

      if (user.clerkId) {
        try {
          const { clerkClient } = await import("@clerk/express");
          await clerkClient.users.deleteUser(user.clerkId);
        } catch (err: any) {
          console.error(`[Auth] Failed to delete user ${userId} from Clerk:`, err.message);
        }
      }

      res.json({ success: true, message: "Profile deleted successfully" });
    }
  );
}
