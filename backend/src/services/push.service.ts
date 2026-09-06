/**
 * push.service.ts — Expo Push Notification sender
 * Uses Expo's free push relay: https://exp.host/--/api/v2/push/send
 * No Firebase or additional service needed for Expo managed apps.
 */

import { User } from "@/models";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export class PushService {
  /**
   * Send a push notification to a specific user by their MongoDB _id.
   * Looks up all registered Expo push tokens for the user and sends to each.
   */
  static async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const user = await User.findById(userId)
        .select("expoPushTokens")
        .lean();

      if (!user?.expoPushTokens || user.expoPushTokens.length === 0) {
        // User has no registered push tokens — skip silently
        return;
      }

      const messages: ExpoPushMessage[] = user.expoPushTokens.map(
        (token: string) => ({
          to: token,
          title,
          body,
          data: data || {},
          sound: "default" as const,
          channelId: "default",
          priority: "high" as const,
        })
      );

      await PushService.sendBatch(messages);
    } catch (err) {
      // Push failures should never crash the main request
      console.error("[PushService] sendToUser failed:", err);
    }
  }

  /**
   * Send push notifications to multiple users at once.
   */
  static async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const users = await User.find({
        _id: { $in: userIds },
        expoPushTokens: { $exists: true, $ne: [] },
      })
        .select("expoPushTokens")
        .lean();

      const messages: ExpoPushMessage[] = [];
      for (const user of users) {
        for (const token of user.expoPushTokens || []) {
          messages.push({
            to: token,
            title,
            body,
            data: data || {},
            sound: "default",
            channelId: "default",
            priority: "high",
          });
        }
      }

      if (messages.length > 0) {
        await PushService.sendBatch(messages);
      }
    } catch (err) {
      console.error("[PushService] sendToUsers failed:", err);
    }
  }

  /**
   * Internal: send a batch of messages to Expo Push API.
   * Expo supports up to 100 messages per request.
   */
  private static async sendBatch(
    messages: ExpoPushMessage[]
  ): Promise<void> {
    // Chunk into batches of 100 (Expo limit)
    const chunks: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          console.error(
            "[PushService] Expo API error:",
            response.status,
            await response.text()
          );
          continue;
        }

        const result = await response.json();
        const tickets: ExpoPushTicket[] = result.data || [];

        // Clean up invalid tokens
        const invalidTokens: string[] = [];
        tickets.forEach((ticket, index) => {
          if (
            ticket.status === "error" &&
            ticket.details?.error === "DeviceNotRegistered"
          ) {
            invalidTokens.push(chunk[index].to);
          }
        });

        if (invalidTokens.length > 0) {
          await PushService.removeInvalidTokens(invalidTokens);
        }

        console.log(
          `[PushService] Sent ${chunk.length} push(es), ${invalidTokens.length} invalid tokens cleaned`
        );
      } catch (err) {
        console.error("[PushService] Batch send error:", err);
      }
    }
  }

  /**
   * Remove expired/invalid tokens from all users.
   */
  private static async removeInvalidTokens(tokens: string[]): Promise<void> {
    try {
      await User.updateMany(
        { expoPushTokens: { $in: tokens } },
        { $pull: { expoPushTokens: { $in: tokens } } }
      );
      console.log(
        `[PushService] Removed ${tokens.length} invalid push token(s)`
      );
    } catch (err) {
      console.error("[PushService] Failed to remove invalid tokens:", err);
    }
  }
}

export default PushService;
