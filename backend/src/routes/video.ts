import { Router } from "express";
import { optionalAuth } from "@/middleware/auth";
import { VideoController } from "@/controllers/video.controller";

const router = Router();

// POST /api/video/token - Generate JaaS JWT token
router.post("/token", optionalAuth, VideoController.getToken);

export default router;
