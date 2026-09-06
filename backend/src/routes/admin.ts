import { Router } from "express";
import { requireAuth, optionalAuth, requireRole, requirePermission } from "@/middleware/auth";
import { AdminController } from "@/controllers/admin.controller";
import { PlanController } from "@/controllers/plan.controller";
import { DelegatedAccessController } from "@/controllers/delegated-access.controller";
import multer from "multer";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// My access route (available for any authenticated user to check their permissions)
router.get("/permissions/my-access", optionalAuth, DelegatedAccessController.getMyAccess);

// Analytics & Stats
router.get("/stats", requirePermission("canViewAnalytics"), AdminController.platformStats);
router.get("/org-stats", requirePermission("canViewAnalytics"), AdminController.orgStats);
router.get("/platform-counts", requirePermission("canViewAnalytics"), AdminController.platformCounts);

// User Management
router.get("/users", requirePermission("canManageUsers"), AdminController.listAllUsers);
router.delete("/user/:id", requirePermission("canManageUsers"), AdminController.deleteUser);

// Therapist Management
router.get("/therapists", requirePermission("canManageTherapists"), AdminController.pendingTherapists);
router.patch("/therapist/:id/verify", requirePermission("canManageTherapists"), AdminController.verifyTherapist);
router.post("/therapists/:id/revoke-org", requirePermission("canManageTherapists"), AdminController.revokeTherapistOrg);
router.patch("/therapist/:id/mark-paid", requireRole(["super_admin"]), AdminController.markTherapistPaid);

// Password verification helpers
router.post("/verify-password-public", AdminController.verifyPasswordPublic);
router.post("/verify-password", optionalAuth, AdminController.verifyPassword);

// Organization Management
router.get("/pending-orgs", requirePermission("canManageOrganizations"), AdminController.pendingOrgs);
router.get("/org/:id/linked-users", requirePermission("canManageOrganizations"), AdminController.getOrgLinkedUsers);
router.post("/org/:id/upload-emails", requirePermission("canManageOrganizations"), upload.single("file"), AdminController.uploadOrgEmailsAdmin);
router.patch("/org/:id/verify", requirePermission("canManageOrganizations"), AdminController.verifyOrg);
router.patch("/org/:id/toggle-external-therapists", requirePermission("canManageOrganizations"), AdminController.toggleExternalTherapists);
router.patch("/org/:id/toggle-cover-therapy", requirePermission("canManageOrganizations"), AdminController.toggleCoverMemberTherapyFees);
router.delete("/org/:id", requirePermission("canManageOrganizations"), AdminController.deleteOrg);

// Subscription Plans (Super Admin)
router.post("/plans", requireAuth, requireRole(["super_admin"]), PlanController.createPlan);
router.put("/plans/:id", requireAuth, requireRole(["super_admin"]), PlanController.updatePlan);
router.delete("/plans/:id", requireAuth, requireRole(["super_admin"]), PlanController.deletePlan);

// Access Control Management (Super Admin or full admin)
router.get("/permissions", requirePermission("isSuperAdmin"), DelegatedAccessController.listAccess);
router.post("/permissions", requirePermission("isSuperAdmin"), DelegatedAccessController.upsertAccess);
router.delete("/permissions/:id", requirePermission("isSuperAdmin"), DelegatedAccessController.revokeAccess);

export default router;
