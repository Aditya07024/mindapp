import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { AuthController } from "@/controllers/auth.controller";
import { UserController } from "@/controllers/user.controller";
import { ReportController } from "@/controllers/report.controller";

const router = Router();

router.get("/me", requireAuth, AuthController.me);
router.get("/stats", requireAuth, UserController.stats);
router.get("/profile", requireAuth, UserController.profile);
router.get("/notifications", requireAuth, UserController.notifications);

// Report & Sharing
router.get("/report", requireAuth, ReportController.getUserReport);
router.post("/report/share", requireAuth, ReportController.shareReport);
router.get("/report/shares", requireAuth, ReportController.getUserShares);

export default router;
