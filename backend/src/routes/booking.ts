import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { BookingController } from "@/controllers/booking.controller";

const router = Router();

router.get("/", requireAuth, BookingController.getMyBookings);
router.post("/", requireAuth, BookingController.createBooking);
router.get("/:bookingId", requireAuth, BookingController.getSingleBooking);
router.delete("/:bookingId/cancel", requireAuth, BookingController.cancelBooking);
router.get("/:bookingId/video-token", requireAuth, BookingController.getVideoToken);
router.post("/:bookingId/rate", requireAuth, BookingController.rateSession);
router.get("/:bookingId/ai-brief", requireAuth, BookingController.getAiBrief);
router.patch("/:bookingId/notes", requireAuth, BookingController.saveNotes);
router.patch("/:bookingId/prescription", requireAuth, BookingController.savePrescription);

// Journal Consent sharing
router.post("/:bookingId/request-journal", requireAuth, BookingController.requestJournalReport);
router.post("/:bookingId/respond-journal", requireAuth, BookingController.respondToJournalRequest);
router.get("/:bookingId/shared-journals", requireAuth, BookingController.getSharedJournals);

export default router;


