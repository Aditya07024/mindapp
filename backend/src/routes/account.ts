import { Router } from "express";
import { AccountController } from "@/controllers/account.controller";
import { requireAuth } from "@/middleware/auth";

const router = Router();

// DELETE /api/account — Requires authentication token
router.delete("/", requireAuth, AccountController.deleteAccount);

export default router;
