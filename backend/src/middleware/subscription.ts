import type { NextFunction, Response } from "express";
import { Subscription, User } from "@/models";
import type { AuthedRequest } from "./auth";
import { AppError } from "@/lib/app-error";

export async function requireSubscription(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }

    const { sub: userId, role } = req.user;
    console.log(`[requireSubscription] userId=${userId} role=${role} path=${req.path}`);

    // Super Admin is exempt
    if (role === "super_admin") {
      console.log(`[requireSubscription] PASS — super_admin`);
      return next();
    }

    const user = await User.findById(userId).select("orgId tier").lean();
    if (!user) {
      console.log(`[requireSubscription] FAIL — user not found`);
      return next(new AppError("User not found", 404));
    }

    console.log(`[requireSubscription] user.tier=${user.tier} user.orgId=${user.orgId}`);

    if (role === "org_admin") {
      if (!user.orgId) {
        console.log(`[requireSubscription] FAIL — org_admin has no orgId`);
        return next(new AppError("Organization not found for this admin", 403));
      }

      const activeSub = await Subscription.findOne({
        orgId: user.orgId,
        status: "active",
      }).lean();

      console.log(`[requireSubscription] org activeSub=${activeSub?._id ?? "NONE"}`);

      if (!activeSub) {
        return next(new AppError("Active organization subscription required", 403));
      }
    } else if (role === "therapist") {
      if (user.orgId) {
        const activeOrgSub = await Subscription.findOne({
          orgId: user.orgId,
          status: "active",
        }).lean();

        console.log(`[requireSubscription] attached therapist orgSub=${activeOrgSub?._id ?? "NONE"}`);

        if (!activeOrgSub) {
          return next(new AppError("Active organization subscription required for therapist access", 403));
        }
      } else {
        const activeSub = await Subscription.findOne({
          userId,
          status: "active",
        }).lean();

        const hasNonFreeTier = user.tier && user.tier !== "free";

        console.log(`[requireSubscription] independent therapist activeSub=${activeSub?._id ?? "NONE"} tier=${user.tier} hasNonFreeTier=${hasNonFreeTier}`);

        if (!activeSub && !hasNonFreeTier) {
          console.log(`[requireSubscription] FAIL — no active sub and tier=free`);
          return next(new AppError("Active subscription required for independent therapists", 403));
        }
      }
    }

    console.log(`[requireSubscription] PASS`);
    next();
  } catch (error) {
    next(error);
  }
}
