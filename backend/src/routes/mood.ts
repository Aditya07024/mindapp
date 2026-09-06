import { Router } from "express";
import { MoodController } from "@/controllers/mood.controller";
import { requireAuth } from "@/middleware/auth";

const router = Router();

router.use(requireAuth);
router.post("/", MoodController.recordMood);
router.get("/history", MoodController.getMoodHistory);
router.get("/calendar", MoodController.getEmotionalCalendar);
router.get("/insights", MoodController.getMoodTrends);
router.get("/trends", MoodController.getMoodTrends);

export default router;
