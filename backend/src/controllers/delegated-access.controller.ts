import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { DelegatedAccess, User } from "@/models";
import { AppError } from "@/lib/app-error";
import mongoose from "mongoose";

export class DelegatedAccessController {
  /**
   * GET /api/admin/permissions - List all delegated access records
   */
  static listAccess = asyncHandler(async (_req: AuthedRequest, res: Response) => {
    const list = await DelegatedAccess.find()
      .populate("grantedBy", "name email role")
      .sort({ createdAt: -1 });

    res.json({ permissions: list });
  });

  /**
   * POST /api/admin/permissions - Create or update delegated access for an email ID
   */
  static upsertAccess = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const {
      email,
      name,
      roleTitle,
      canHostMeeting,
      canViewRegistrations,
      canManageUsers,
      canManageTherapists,
      canManageOrganizations,
      canViewAnalytics,
      canManageWorkshopPopup,
      isFullAdmin,
    } = req.body;

    if (!email || !String(email).trim()) {
      throw new AppError("Email address is required", 400);
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new AppError("Please enter a valid email address", 400);
    }

    let access = await DelegatedAccess.findOne({ email: cleanEmail });

    if (access) {
      access.name = name !== undefined ? String(name).trim() : access.name;
      access.roleTitle = roleTitle !== undefined ? String(roleTitle).trim() : access.roleTitle;
      access.canHostMeeting = canHostMeeting !== undefined ? Boolean(canHostMeeting) : access.canHostMeeting;
      access.canViewRegistrations = canViewRegistrations !== undefined ? Boolean(canViewRegistrations) : access.canViewRegistrations;
      access.canManageUsers = canManageUsers !== undefined ? Boolean(canManageUsers) : access.canManageUsers;
      access.canManageTherapists = canManageTherapists !== undefined ? Boolean(canManageTherapists) : access.canManageTherapists;
      access.canManageOrganizations = canManageOrganizations !== undefined ? Boolean(canManageOrganizations) : access.canManageOrganizations;
      access.canViewAnalytics = canViewAnalytics !== undefined ? Boolean(canViewAnalytics) : access.canViewAnalytics;
      access.canManageWorkshopPopup = canManageWorkshopPopup !== undefined ? Boolean(canManageWorkshopPopup) : access.canManageWorkshopPopup;
      access.isFullAdmin = isFullAdmin !== undefined ? Boolean(isFullAdmin) : access.isFullAdmin;
      if (req.user?.sub && mongoose.Types.ObjectId.isValid(req.user.sub)) {
        access.grantedBy = new mongoose.Types.ObjectId(req.user.sub);
      }
      await access.save();
    } else {
      access = await DelegatedAccess.create({
        email: cleanEmail,
        name: name ? String(name).trim() : "",
        roleTitle: roleTitle ? String(roleTitle).trim() : "Delegated Admin",
        canHostMeeting: Boolean(canHostMeeting),
        canViewRegistrations: Boolean(canViewRegistrations),
        canManageUsers: Boolean(canManageUsers),
        canManageTherapists: Boolean(canManageTherapists),
        canManageOrganizations: Boolean(canManageOrganizations),
        canViewAnalytics: Boolean(canViewAnalytics),
        canManageWorkshopPopup: Boolean(canManageWorkshopPopup),
        isFullAdmin: Boolean(isFullAdmin),
        grantedBy: req.user?.sub && mongoose.Types.ObjectId.isValid(req.user.sub) ? new mongoose.Types.ObjectId(req.user.sub) : undefined,
      });
    }

    res.status(200).json({
      message: `Permissions updated successfully for ${cleanEmail}`,
      permission: access,
    });
  });

  /**
   * DELETE /api/admin/permissions/:id - Revoke delegated access
   */
  static revokeAccess = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const access = await DelegatedAccess.findByIdAndDelete(id);

    if (!access) {
      throw new AppError("Delegated access record not found", 404);
    }

    res.json({
      message: `Delegated access revoked for ${access.email}`,
      id: access._id,
    });
  });

  /**
   * GET /api/admin/permissions/my-access - Get permissions for the current user's email
   */
  static getMyAccess = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const isSuperAdminRole = req.user?.role === "super_admin" || req.user?.role === "admin";

    if (isSuperAdminRole) {
      return res.json({
        email: req.user?.clerkId || "admin",
        role: req.user?.role || "super_admin",
        isSuperAdmin: true,
        isFullAdmin: true,
        canHostMeeting: true,
        canViewRegistrations: true,
        canManageUsers: true,
        canManageTherapists: true,
        canManageOrganizations: true,
        canViewAnalytics: true,
        canManageWorkshopPopup: true,
      });
    }

    const { getPossibleUserEmails } = await import("@/middleware/auth");
    const userEmails = await getPossibleUserEmails(req);

    for (const email of userEmails) {
      const delegated = await DelegatedAccess.findOne({ email });
      if (delegated) {
        return res.json({
          email: delegated.email,
          role: req.user?.role || "user",
          isSuperAdmin: Boolean(delegated.isFullAdmin),
          isFullAdmin: Boolean(delegated.isFullAdmin),
          canHostMeeting: Boolean(delegated.isFullAdmin || delegated.canHostMeeting),
          canViewRegistrations: Boolean(delegated.isFullAdmin || delegated.canViewRegistrations),
          canManageUsers: Boolean(delegated.isFullAdmin || delegated.canManageUsers),
          canManageTherapists: Boolean(delegated.isFullAdmin || delegated.canManageTherapists),
          canManageOrganizations: Boolean(delegated.isFullAdmin || delegated.canManageOrganizations),
          canViewAnalytics: Boolean(delegated.isFullAdmin || delegated.canViewAnalytics),
          canManageWorkshopPopup: Boolean(delegated.isFullAdmin || delegated.canManageWorkshopPopup),
        });
      }
    }

    // Default permissions for non-admin without delegated access
    return res.json({
      email: userEmails[0] || "",
      role: req.user?.role || "user",
      isSuperAdmin: false,
      isFullAdmin: false,
      canHostMeeting: false,
      canViewRegistrations: false,
      canManageUsers: false,
      canManageTherapists: false,
      canManageOrganizations: false,
      canViewAnalytics: false,
      canManageWorkshopPopup: false,
    });
  });
}
