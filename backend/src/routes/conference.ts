import { Router } from "express";
import { requireAuth, requireRole, requirePermission, optionalAuth } from "@/middleware/auth";
import { ConferenceController } from "@/controllers/conference.controller";
import { posterUpload } from "@/middleware/upload.middleware";

const router = Router();

// Public / Optionally authenticated routes (Allows guests and logged-in users to list, register, and join conferences)
router.get("/", optionalAuth, ConferenceController.getAllConferences);
router.get("/public", optionalAuth, ConferenceController.getAllConferences);
router.get("/public/:id", optionalAuth, ConferenceController.getConferenceById);
router.post("/register", optionalAuth, ConferenceController.registerConference);
router.post("/payments/verify", optionalAuth, ConferenceController.verifyPayment);
router.post("/:id/sync-payment", optionalAuth, ConferenceController.syncPayment);
router.get("/:id", optionalAuth, ConferenceController.getConferenceById);
router.get("/:id/join", optionalAuth, ConferenceController.getJoinInfo);
router.post("/:id/track", optionalAuth, ConferenceController.trackAttendance);
router.get("/:id/waiting-room", optionalAuth, ConferenceController.getWaitingRoomAttendees);
router.post("/:id/check-email", optionalAuth, ConferenceController.checkEmailStatus);
router.post("/:id/waiting-room/admit", optionalAuth, ConferenceController.admitAttendee);
router.post("/:id/waiting-room/allow-waiting", optionalAuth, ConferenceController.allowWaitingRoom);
router.post("/:id/waiting-room/admit-all", optionalAuth, ConferenceController.admitAllAttendees);
router.post("/:id/waiting-room/deny", optionalAuth, ConferenceController.denyAttendee);

// Admin endpoints require authentication
router.use(requireAuth);

// Admin endpoints for creation, editing, and publishing conferences
router.post("/upload-poster", requirePermission("canHostMeeting"), posterUpload.single("poster"), ConferenceController.uploadPoster);
router.post("/:id/poster", requirePermission("canHostMeeting"), posterUpload.single("poster"), ConferenceController.uploadConferencePosterById);
router.post("/", requirePermission("canHostMeeting"), ConferenceController.createConference);
router.put("/:id", requirePermission("canHostMeeting"), ConferenceController.updateConference);
router.delete("/:id", requirePermission("canHostMeeting"), ConferenceController.deleteConference);
router.patch("/:id/publish", requirePermission("canHostMeeting"), ConferenceController.togglePublish);
router.patch("/:id/pin", requirePermission("canHostMeeting"), ConferenceController.togglePin);

// Admin Attendee & Analytics routes
router.get("/admin/:id/attendees", requirePermission("canViewRegistrations"), ConferenceController.getAttendees);
router.get("/admin/:id/analytics", requirePermission("canViewRegistrations"), ConferenceController.getAnalytics);
router.patch("/admin/:id/attendees/:registrationId", requirePermission("canViewRegistrations"), ConferenceController.updateAttendee);
router.delete("/admin/:id/attendees/:registrationId", requirePermission("canViewRegistrations"), ConferenceController.removeAttendee);
router.get("/admin/:id/export", requirePermission("canViewRegistrations"), ConferenceController.exportAttendees);

export default router;
