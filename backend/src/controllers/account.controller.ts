import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import {
  User,
  Organization,
  Mood,
  Conversation,
  JournalEntry,
  TherapistBooking,
  Notification,
  SharedReport,
  AIReport,
  Subscription,
  WalletTransaction,
  TherapistRecommendation,
  TherapistInvitation,
  ConferenceRegistration,
  ConferencePayment,
} from "@/models";

export class AccountController {
  /**
   * DELETE /api/account
   * Permanently deletes the authenticated user's database records and Clerk user account.
   * If the user is an Organization Admin, also purges the Organization entity, unlinks members, and deletes organization subscriptions.
   * Authentication is enforced via requireAuth middleware (Clerk session token).
   * Never accepts target userId or email from request body or query string.
   */
  static deleteAccount = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.sub;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const clerkIdToDelete = user.clerkId || userId;
    const userEmails: string[] = [];

    if (user.therapistProfile?.email) {
      userEmails.push(user.therapistProfile.email.toLowerCase());
    }

    // Try fetching emails from Clerk as well to ensure thorough purge
    if (clerkIdToDelete) {
      try {
        const { clerkClient } = await import("@clerk/express");
        const clerkUser = await clerkClient.users.getUser(clerkIdToDelete);
        for (const e of clerkUser.emailAddresses) {
          if (e.emailAddress) userEmails.push(e.emailAddress.toLowerCase());
        }
      } catch (err: any) {
        console.warn(`[Account] Could not fetch email from Clerk for user ${userId}:`, err.message);
      }
    }

    const emailFilter = userEmails.length > 0 ? { $in: userEmails } : null;

    // If user is an Organization Admin or associated with an Organization, perform Organization-level cleanup
    const orgId = user.orgId;
    if (orgId) {
      if (user.role === "org_admin") {
        await Promise.all([
          Organization.deleteOne({ _id: orgId }),
          User.updateMany({ orgId }, { $unset: { orgId: 1 } }),
          Subscription.deleteMany({ orgId }),
        ]);
        console.log(`[Account] Deleted Organization ${orgId} and unlinked its members.`);
      }

      await Organization.updateMany(
        {},
        {
          $pull: {
            pendingJoinRequests: { userId },
            "departments.$[].userIds": userId,
          },
        }
      );
    }

    // Delete all associated user data across all database collections
    await Promise.all([
      Mood.deleteMany({ userId }),
      Conversation.deleteMany({ userId }),
      JournalEntry.deleteMany({ userId }),
      TherapistBooking.deleteMany({ $or: [{ userId }, { therapistId: userId }] }),
      Notification.deleteMany({ userId }),
      SharedReport.deleteMany({ $or: [{ userId }, { therapistId: userId }] }),
      AIReport.deleteMany({ userId }),
      Subscription.deleteMany({ userId }),
      WalletTransaction.deleteMany({ userId }),
      TherapistRecommendation.deleteMany({ userId }),
      TherapistInvitation.deleteMany({
        $or: [
          { therapistId: userId },
          ...(emailFilter ? [{ email: emailFilter }] : []),
        ],
      }),
      ConferenceRegistration.deleteMany({
        $or: [
          { userId },
          ...(emailFilter ? [{ email: emailFilter }] : []),
        ],
      }),
      ConferencePayment.deleteMany({
        $or: [
          { userId },
          ...(emailFilter ? [{ email: emailFilter }] : []),
        ],
      }),
      User.deleteOne({ _id: userId }),
    ]);

    // Delete user from Clerk using backend Server SDK
    if (clerkIdToDelete) {
      try {
        const { clerkClient } = await import("@clerk/express");
        await clerkClient.users.deleteUser(clerkIdToDelete);
      } catch (err: any) {
        console.error(`[Account] Failed to delete user ${userId} from Clerk:`, err.message);
      }
    }

    console.log(`[Account] Successfully purged all database records and deleted account for user ID: ${userId}`);

    res.json({
      success: true,
      message: "Your account has been permanently deleted.",
    });
  });
}
