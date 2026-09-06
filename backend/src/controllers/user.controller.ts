import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { User, Mood, TherapistBooking, Conversation } from "@/models";

export class UserController {
  /** GET /user/stats — dashboard stats for the logged-in user */
  static stats = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.sub;

    const user = await User.findById(userId).select("streak").lean();

    const [moods, chatCount, bookingsCount] = await Promise.all([
      Mood.find({ userId }).sort({ createdAt: -1 }).limit(30).select("score createdAt").lean(),
      Conversation.countDocuments({ userId }),
      TherapistBooking.countDocuments({ userId, status: { $in: ["pending", "confirmed"] } })
    ]);

    const moodAvg = moods.length
      ? `${(moods.reduce((s, m) => s + m.score, 0) / moods.length).toFixed(1)}/10`
      : "–";

    res.json({
      streak: user?.streak ?? 0,
      moodAvg,
      chatCount,
      bookingsCount,
      latestMood: moods[0]?.score ?? null,
      latestMoodDate: moods[0]?.createdAt ? new Date(moods[0].createdAt).toISOString().slice(0, 10) : null
    });
  });

  /** GET /user/profile — full profile data for the profile page */
  static profile = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const user = await User.findById(req.user!.sub)
      .select("role fullName language location emergencyContact therapistProfile phoneMasked tier")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  });

  /** GET /user/notifications — real notifications derived from DB activity */
  static notifications = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.sub;
    const user = await User.findById(userId).select("role").lean();
    const role = user?.role ?? "user";

    const notifs: { id: string; message: string; type: string; createdAt: string }[] = [];

    // Booking notifications
    const recentBookings = await TherapistBooking.find({
      $or: [{ userId }, { therapistId: userId }]
    }).sort({ createdAt: -1 }).limit(10).lean();

    for (const b of recentBookings) {
      const slotDate = new Date(b.slot);
      const dateStr = slotDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      if (b.status === "confirmed") {
        notifs.push({
          id: `b-${b._id}`,
          message: role === "therapist"
            ? `New session confirmed for ${dateStr}`
            : `Your appointment is confirmed for ${dateStr}`,
          type: "booking",
          createdAt: b.createdAt?.toISOString?.() ?? new Date().toISOString()
        });
      } else if (b.status === "cancelled") {
        notifs.push({
          id: `bc-${b._id}`,
          message: `Appointment on ${dateStr} was cancelled`,
          type: "alert",
          createdAt: b.updatedAt?.toISOString?.() ?? new Date().toISOString()
        });
      }
    }

    // Mood check-in reminders
    const lastMood = await Mood.findOne({ userId }).sort({ createdAt: -1 }).lean();
    if (!lastMood || (Date.now() - new Date(lastMood.createdAt).getTime()) > 24 * 60 * 60 * 1000) {
      notifs.push({
        id: "mood-reminder",
        message: "You haven't logged your mood today. Take a moment to check in.",
        type: "reminder",
        createdAt: new Date().toISOString()
      });
    }

    // Chat activity
    const chatCount = await Conversation.countDocuments({ userId });
    if (chatCount > 0) {
      notifs.push({
        id: "chat-activity",
        message: `You have ${chatCount} conversation${chatCount > 1 ? "s" : ""} with Manas AI`,
        type: "info",
        createdAt: new Date().toISOString()
      });
    }

    res.json({ notifications: notifs });
  });
}
