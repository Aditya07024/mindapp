import { Router } from "express";
import { OrgController } from "@/controllers/org.controller";
import { requireAuth, requireRole } from "@/middleware/auth";
import { requireSubscription } from "@/middleware/subscription";
import multer from "multer";

// Use memory storage so we can parse the buffer directly with xlsx
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

// Public (auth required, any role)
router.get("/me", requireAuth, OrgController.me);
router.get("/verified", requireAuth, OrgController.getVerifiedOrgs);

// Org onboarding
router.post("/onboarding", requireAuth, OrgController.onboarding);

// ── JOIN REQUEST FLOW (any authenticated user) ──
router.post("/request-join", requireAuth, OrgController.requestJoin);

// ── ORG ADMIN ROUTES ──
router.patch(
  "/settings",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.updateSettings,
);
router.get(
  "/pending-therapists",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.pendingTherapists,
);
router.patch(
  "/therapist/:id/verify",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.verifyTherapist,
);

router.get(
  "/stats",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.dashboardStats,
);
router.get(
  "/users",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.listUsers,
);

// Join request management
router.get(
  "/join-requests",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.listJoinRequests,
);
router.patch(
  "/join-request/:userId/approve",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.approveJoinRequest,
);
router.patch(
  "/join-request/:userId/reject",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.rejectJoinRequest,
);

// Excel email whitelist upload
router.post(
  "/upload-emails",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  upload.single("file"),
  OrgController.uploadEmails,
);

// Manual email whitelist addition
router.post(
  "/whitelist-email",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.whitelistEmail,
);

// Member data
router.get(
  "/members",
  requireAuth,
  requireRole(["org_admin", "therapist"]),
  requireSubscription,
  OrgController.listMembers,
);
router.get(
  "/user-data/:userId",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.getUserData,
);

// ── EXTERNAL THERAPIST INVITATIONS ──
router.post(
  "/invite-therapist",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.inviteTherapist,
);
router.get(
  "/invitations",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.listInvitations,
);
router.delete(
  "/invitation/:id",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.cancelInvitation,
);
router.delete(
  "/therapist/:id",
  requireAuth,
  requireRole(["org_admin"]),
  requireSubscription,
  OrgController.removeTherapistFromOrg,
);

export default router;
