import { Router } from "express";
import { JournalController } from "@/controllers/journal.controller";
import { requireAuth } from "@/middleware/auth";

const router = Router();

router.use(requireAuth);
router.post("/", JournalController.createEntry);
router.get("/", JournalController.getEntries);
router.get("/analytics", JournalController.getAnalytics);
router.get("/prompt", JournalController.getRandomPrompt);

export default router;
