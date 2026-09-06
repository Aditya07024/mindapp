import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { JaasService } from "@/services/jaas.service";
import { AppError } from "@/lib/app-error";

export class VideoController {
  /**
   * POST /api/video/token
   * Generates a JaaS RS256 JWT for 8x8.vc meetings
   */
  static getToken = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { roomName, user, moderator, features } = req.body;

    // 1. Validation
    if (!roomName || typeof roomName !== "string" || !roomName.trim()) {
      throw new AppError("roomName is required", 400);
    }

    if (!user || typeof user !== "object") {
      throw new AppError("user object is required", 400);
    }

    if (!user.name || typeof user.name !== "string" || !user.name.trim()) {
      throw new AppError("user.name is required", 400);
    }

    // Determine moderator status
    const isUserModerator =
      typeof moderator === "boolean"
        ? moderator
        : true;

    // 2. Generate JaaS Token using JaasService helper
    const result = JaasService.generateMeetingToken({
      roomName,
      user: {
        id: user.id || req.user?.sub,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      moderator: isUserModerator,
      features,
    });

    res.json(result);
  });
}
