import { Router } from "express";
import { AuthController } from "@/controllers/auth.controller";
import { requireAuth } from "@/middleware/auth";

const router = Router();

// Public Authentication Endpoints (JWT)
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/forgot-password", AuthController.forgotPassword);

// Protected User Routes (Require JWT Token)
router.get("/me", requireAuth, AuthController.me);
router.patch("/onboarding", requireAuth, AuthController.updateOnboarding);
router.post("/therapist/onboarding", requireAuth, AuthController.therapistOnboarding);
router.patch("/profile", requireAuth, AuthController.updateProfile);
router.delete("/profile", requireAuth, AuthController.deleteProfile);
router.patch("/role", requireAuth, AuthController.setRole);
router.post("/push-token", requireAuth, AuthController.registerPushToken);

export default router;
