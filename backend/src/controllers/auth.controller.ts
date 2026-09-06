import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { asyncHandler } from "@/lib/async-handler";
import { AuthService } from "@/services/auth.service";
import { JWT_SECRET, type AuthedRequest } from "@/middleware/auth";
import { User } from "@/models";
import { sendPasswordResetEmail } from "@/lib/mail";

function serializeUser(user: any) {
  return {
    id: user._id,
    username: user.username,
    email: user.email || user.phoneMasked,
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
  /** POST /auth/register — Account creation with username, email, password, repassword */
  static register = asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password, repassword, role } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: "Username is required" });
    }
    if (!email || !email.trim() || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email address is required" });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ error: "Password is required" });
    }
    if (password !== repassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingEmail = await User.findOne({
      $or: [{ email: cleanEmail }, { phoneMasked: cleanEmail }]
    });
    if (existingEmail) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username: cleanUsername });
    if (existingUsername) {
      return res.status(400).json({ error: "Username is already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const validRoles = ["user", "therapist", "org_admin", "super_admin"];
    const userRole = validRoles.includes(role) ? role : "user";

    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      phoneMasked: cleanEmail,
      fullName: username.trim(),
      passwordHash,
      role: userRole,
      isAnonymous: false,
      onboarding: { concerns: [] },
    });

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      token,
      user: serializeUser(user),
    });
  });

  /** POST /auth/login — Sign in with email/username and password */
  static login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const cleanIdentifier = email.toLowerCase().trim();

    const user: any = await User.findOne({
      $or: [
        { email: cleanIdentifier },
        { username: cleanIdentifier },
        { phoneMasked: cleanIdentifier }
      ]
    }).select("+passwordHash");

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid email/username or password" });
    }

    if (user.deletedAt) {
      return res.status(401).json({ error: "Account has been deactivated" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email/username or password" });
    }

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token,
      user: serializeUser(user),
    });
  });

  /** POST /auth/forgot-password — Send new password via email */
  static forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email address is required" });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user: any = await User.findOne({
      $or: [{ email: cleanEmail }, { phoneMasked: cleanEmail }]
    });

    if (!user) {
      // Don't reveal account non-existence for security, but return friendly response
      return res.json({
        success: true,
        message: "If an account with that email exists, a new password has been sent to your email address."
      });
    }

    // Generate random 8-character password
    const newPassword = "Mind@" + Math.random().toString(36).substring(2, 8);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    user.passwordHash = passwordHash;
    await user.save();

    // Send email with new password
    const emailSent = await sendPasswordResetEmail(cleanEmail, newPassword);

    res.json({
      success: true,
      message: emailSent
        ? `A new password has been sent to ${cleanEmail}. Please check your inbox and log in.`
        : `Your password has been reset to: ${newPassword} (Note: SMTP not configured, password displayed here for testing)`
    });
  });

  /** GET /auth/me — returns current JWT-authed user's MongoDB profile */
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

      user.role = "therapist";

      let sessionFee = 899;
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

  static registerPushToken = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { token } = req.body;

      if (!token || typeof token !== "string" || !token.startsWith("ExponentPushToken[")) {
        return res.status(400).json({ error: "Invalid Expo push token" });
      }

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

      res.json({ success: true, message: "Profile deleted successfully" });
    }
  );
}
