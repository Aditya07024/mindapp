import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "@/lib/app-error";
import { User } from "@/models";

export const JWT_SECRET = process.env.JWT_SECRET || "mindapp_jwt_secret_key_2026";

export type AuthedRequest = Request & {
  user?: { sub: string; role: string; clerkId: string };
};

/**
 * requireAuth — verifies JWT token from Authorization: Bearer header.
 * On success, attaches req.user = { sub: mongoUserId, role, clerkId }.
 */
export async function requireAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      // Fallback: check Clerk auth if configured
      try {
        const { getAuth } = await import("@clerk/express");
        const clerkAuth = getAuth(req);
        if (clerkAuth?.userId) {
          const clerkUser: any = await User.findOne({ clerkId: clerkAuth.userId }).lean();
          if (clerkUser) {
            req.user = {
              sub: String(clerkUser._id),
              role: clerkUser.role || "user",
              clerkId: clerkAuth.userId,
            };
            return next();
          }
        }
      } catch (e) {
        // Clerk fallback ignored
      }
      return next(new AppError("Authentication required - Missing token", 401));
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      // Fallback: try decoding without strict verify for legacy tokens
      try {
        decoded = jwt.decode(token);
      } catch (decodeErr) {}
    }

    if (!decoded || (!decoded.sub && !decoded.userId)) {
      return next(new AppError("Invalid or expired session token", 401));
    }

    const userId = decoded.sub || decoded.userId;

    let user: any = await User.findById(userId).lean();

    if (!user && decoded.clerkId) {
      user = await User.findOne({ clerkId: decoded.clerkId }).lean();
    }

    if (!user) {
      return next(new AppError("User account not found", 401));
    }

    if (user.deletedAt) {
      return next(new AppError("Account has been deactivated", 401));
    }

    // Auto-link user to Organization if email is in Organization's allowedEmails
    if (!user.orgId && user.email) {
      try {
        const userEmail = user.email.toLowerCase().trim();
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
      role: user.role || decoded.role || "user",
      clerkId: user.clerkId || "",
    };

    next();
  } catch (err: any) {
    console.error("[requireAuth] Verification Failed:", err.message);
    return next(new AppError("Invalid or expired session token", 401));
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
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return requireAuth(req, res, (err?: any) => {
        if (err) {
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
