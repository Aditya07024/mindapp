import { Router } from "express";
import { requireAuth, optionalAuth } from "@/middleware/auth";
import { MeetingPhotoController } from "@/controllers/meeting-photo.controller";
import { posterUpload } from "@/middleware/upload.middleware";

const router = Router();

// Public route to fetch active meeting photos for landing page
router.get("/", optionalAuth, MeetingPhotoController.getPublicList);

// Admin routes
router.get("/admin/all", requireAuth, MeetingPhotoController.getAdminList);
router.post("/upload", requireAuth, posterUpload.any(), MeetingPhotoController.uploadPhoto);
router.post("/", requireAuth, MeetingPhotoController.createPhoto);
router.put("/:id", requireAuth, MeetingPhotoController.updatePhoto);
router.delete("/:id", requireAuth, MeetingPhotoController.deletePhoto);

export default router;
