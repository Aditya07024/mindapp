import { Router } from "express";
import { ChatController } from "@/controllers/chat.controller";
import { requireAuth } from "@/middleware/auth";

const router = Router();

router.use(requireAuth);
router.post("/", ChatController.sendMessage);
router.post("/message", ChatController.sendMessage);
router.get("/history", ChatController.getConversationHistory);

export default router;
