import type { NextFunction, Request, Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { AppError } from "@/lib/app-error";
import { User } from "@/models";

export type AuthedRequest = Request & {
  user?: { sub: string; role: string; clerkId: string };
};

/**
 * requireAuth — verifies Clerk session token from Authorization: Bearer header.
 * On success, attaches req.user = { sub: mongoUserId, role, clerkId }.
 * Creates the MongoDB user record on first login (auto-provisioning).
 */
export async function requireAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    let { userId: clerkUserId } = getAuth(req);

    if (!clerkUserId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
          const jwt = await import("jsonwebtoken");
          const decoded: any = jwt.decode(token);
          if (decoded && decoded.sub) {
            clerkUserId = decoded.sub;
          }
        } catch (jwtErr) {
          console.warn("Fallback JWT decode failed:", jwtErr);
        }
      }
    }

    if (!clerkUserId) {
      return next(new AppError("Unauthorized - No Clerk User", 401));
    }

    // Look up or auto-provision the MongoDB user
    let user: any = await User.findOne({
      $or: [{ clerkId: clerkUserId }, { phoneHash: clerkUserId }],
    }).lean();

    if (user && user.deletedAt) {
      // Reactivate: user is signing up again after deleting their account
      await User.updateOne(
        { _id: user._id },
        { $unset: { deletedAt: 1 }, $set: { clerkId: clerkUserId } },
      );
      user.deletedAt = undefined;
      user.clerkId = clerkUserId;
    }

    if (user && !user.clerkId) {
      await User.updateOne(
        { _id: user._id },
        { $set: { clerkId: clerkUserId } },
      );
      user.clerkId = clerkUserId;
    }

    if (!user) {
      // First login — fetch Clerk user profile to populate name/email
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
      const fullName = [clerkUser.firstName, clerkUser.lastName]
        .filter(Boolean)
        .join(" ");

      if (email) {
        // Search by email in phoneMasked (case-insensitive)
        user = await User.findOne({
          $or: [
            { phoneMasked: email },
            { phoneMasked: email.toLowerCase() },
            { phoneMasked: { $regex: new RegExp(`^${email}$`, "i") } }
          ]
        }).lean();

        if (user) {
          // Link Clerk ID to existing MongoDB user
          await User.updateOne(
            { _id: user._id },
            { $set: { clerkId: clerkUserId } }
          );
          user.clerkId = clerkUserId;
        }
      }

      try {
        // Detect intended role from header or Clerk metadata
        let intentRole = (req.headers["x-intent-role"] as string) || (clerkUser.publicMetadata?.role as string);
        
        // Normalize role
        if (intentRole === "super admin" || intentRole === "super-admin") intentRole = "super_admin";
        if (intentRole === "org admin" || intentRole === "org-admin") intentRole = "org_admin";

        const validRoles = ["user", "therapist", "org_admin", "super_admin"];
        const roleToAssign = validRoles.includes(intentRole) ? intentRole : "user";

        const created = await User.create({
          clerkId: clerkUserId,
          phoneHash: clerkUserId, // use clerkId as unique key
          phoneMasked: email || clerkUserId.slice(-8),
          fullName: fullName || undefined,
          role: roleToAssign,
          isAnonymous: false,
          onboarding: { concerns: [] },
        });
        user = created.toObject() as any;
      } catch (createErr: any) {
        if (createErr.code === 11000) {
          user = await User.findOne({ clerkId: clerkUserId }).lean();
        }
        if (!user) throw createErr;
      }
    }

    if (!user) {
      return next(new AppError("Failed to create or fetch user", 500));
    }

    // Auto-link user to Organization if email is in Organization's allowedEmails
    if (!user.orgId && (user.phoneMasked?.includes("@") || user.email)) {
      try {
        const userEmail = (user.email || user.phoneMasked || "").toLowerCase().trim();
        if (userEmail) {
          const { Organization } = await import("@/models/organization");
          const matchingOrg = await Organization.findOne({
            allowedEmails: userEmail,
            verificationStatus: "verified",
          });

          if (matchingOrg) {
            await User.updateOne({ _id: user._id }, { $set: { orgId: matchingOrg._id } });
            user.orgId = matchingOrg._id;

            // Auto approve join request if present
            await Organization.updateOne(
              { _id: matchingOrg._id, "pendingJoinRequests.userId": user._id },
              { $set: { "pendingJoinRequests.$.status": "approved", "pendingJoinRequests.$.autoApproved": true } }
            );
          }
        }
      } catch (orgLinkErr) {
        console.error("Auto org link check failed:", orgLinkErr);
      }
    }

    req.user = {
      sub: String(user._id),
      role: user.role || "user",
      clerkId: clerkUserId,
    };

    next();
  } catch (err: any) {
    console.error("Clerk Token Verification Failed:", err.message);
    return next(new AppError("Invalid or expired session", 401));
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Forbidden", 403));
    }
    next();
  };
}

export async function getPossibleUserEmails(req: AuthedRequest): Promise<string[]> {
  if (!req.user) return [];
  const emails: string[] = [];

  try {
    const { User } = await import("@/models/user");
    const dbUser: any = await User.findById(req.user.sub).select("email phoneMasked therapistProfile role");
    if (dbUser?.email) emails.push(dbUser.email);
    if (dbUser?.phoneMasked) emails.push(dbUser.phoneMasked);
    if (dbUser?.therapistProfile?.email) emails.push(dbUser.therapistProfile.email);
  } catch (e) {}

  if (req.user.clerkId) {
    try {
      const clerkUser = await clerkClient.users.getUser(req.user.clerkId);
      if (clerkUser.emailAddresses?.[0]?.emailAddress) {
        emails.push(clerkUser.emailAddresses[0].emailAddress);
      }
    } catch (e) {}
  }

  return Array.from(new Set(emails.map((e) => String(e).toLowerCase().trim()).filter(Boolean)));
}

export function requirePermission(permissionName: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const runPermissionCheck = async () => {
      if (!req.user) {
        return next(new AppError("Authentication required", 401));
      }

      if (req.user.role === "super_admin" || req.user.role === "admin") {
        return next();
      }

      try {
        const { DelegatedAccess } = await import("@/models/delegated-access");
        const userEmails = await getPossibleUserEmails(req);

        for (const email of userEmails) {
          const access: any = await DelegatedAccess.findOne({ email });
          if (access && (access.isFullAdmin || access[permissionName])) {
            return next();
          }
        }
      } catch (err) {
        console.error("[requirePermission] Error checking permissions:", err);
      }

      return next(new AppError("Forbidden: Insufficient delegated permissions", 403));
    };

    if (!req.user) {
      return requireAuth(req, res, runPermissionCheck as any);
    }
    return runPermissionCheck();
  };
}

export async function optionalAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    let authUserId = getAuth(req)?.userId;
    const authHeader = req.headers.authorization;

    if (!authUserId && authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const jwt = await import("jsonwebtoken");
        const decoded: any = jwt.decode(token);
        if (decoded?.sub) authUserId = decoded.sub;
      } catch (e) {}
    }

    if (authUserId) {
      return requireAuth(req, res, (err?: any) => {
        if (err) {
          console.warn("[optionalAuth] Auth attempt failed, continuing as guest:", err.message);
          req.user = undefined;
          return next();
        }
        return next();
      });
    }
  } catch (e) {
    // ignore token errors for optional auth
  }
  req.user = undefined;
  next();
}
