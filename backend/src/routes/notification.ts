import { Router } from "express";
import { NotificationController } from "@/controllers/notification.controller";
import { optionalAuth, requireAuth } from "@/middleware/auth";

const router = Router();

router.get("/", optionalAuth, NotificationController.getMyNotifications);
router.put("/read-all", requireAuth, NotificationController.markAllAsRead);
router.put("/:id/read", requireAuth, NotificationController.markAsRead);

export default router;
