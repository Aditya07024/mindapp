import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { AppError } from "@/lib/app-error";
import { Notification } from "@/models/notification";
import { PushService } from "@/services/push.service";

export class NotificationController {
  /** Helper to trigger notifications from backend events — also sends push */
  static createNotification = async (
    userId: string,
    title: string,
    body: string,
    type: "booking" | "approval" | "crisis_alert" | "system",
    metadata?: Record<string, any>
  ) => {
    try {
      const notif = await Notification.create({
        userId,
        title,
        body,
        type,
        metadata
      });

      // Fire push notification to user's registered devices
      PushService.sendToUser(userId, title, body, {
        type,
        notificationId: notif._id?.toString(),
        ...metadata,
      }).catch((err) =>
        console.error("[Notification] Push send failed (non-blocking):", err)
      );

      return notif;
    } catch (err) {
      console.error("[Notification] Error creating backend alert:", err);
    }
  };

  /** GET /api/notifications */
  static getMyNotifications = asyncHandler(async (req: AuthedRequest, res: Response) => {
    try {
      if (!req.user?.sub) {
        return res.json({ notifications: [] });
      }
      const notifications = await Notification.find({ userId: req.user.sub })
        .sort({ createdAt: -1 })
        .limit(100);
      res.json({ notifications });
    } catch (error) {
      res.json({ notifications: [] });
    }
  });

  /** PUT /api/notifications/:id/read */
  static markAsRead = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: id, userId: req.user!.sub },
        { read: true },
        { new: true }
      );
      if (!notification) {
        throw new AppError("Notification not found or access denied", 404);
      }
      res.json({ notification });
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : "Failed to mark notification as read", 400);
    }
  });

  /** PUT /api/notifications/read-all */
  static markAllAsRead = asyncHandler(async (req: AuthedRequest, res: Response) => {
    try {
      await Notification.updateMany({ userId: req.user!.sub, read: false }, { read: true });
      res.json({ success: true });
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : "Failed to mark all as read", 400);
    }
  });
}
