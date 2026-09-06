import { Mood, User } from "@/models";

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export class MoodService {
  static async recordMood(userId: string, score: number, tags: string[], note?: string) {
    const date = new Date();
    const moodEntry = await Mood.create({
      userId,
      score,
      tags,
      note,
      date
    });

    await this.updateStreak(userId, date);
    return moodEntry;
  }

  static async getMoodHistory(userId: string, days = 30) {
    const user = await User.findById(userId).lean();
    if (!user) return [];

    let limitDays = 7; // default for Free

    const { Subscription } = await import("@/models");
    const activeSub = await Subscription.findOne({
      userId,
      status: "active",
    }).lean();

    if (activeSub) {
      if (activeSub.plan === "Apna Mann") {
        limitDays = 25;
      } else if (activeSub.plan === "Mann Shanti") {
        limitDays = 30;
      } else {
        limitDays = 30;
      }
    } else if (user.orgId) {
      limitDays = 30;
    }

    const queryDays = Math.min(days, limitDays);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - queryDays);

    return Mood.find({ userId, date: { $gte: startDate } }).sort({ date: -1 });
  }

  static async getMoodTrends(userId: string) {
    const moods = await this.getMoodHistory(userId, 30);
    const averageScore =
      moods.length > 0 ? moods.reduce((sum, mood) => sum + mood.score, 0) / moods.length : 0;

    const weekly = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = toDayKey(date);
      const matches = moods.filter((mood) => toDayKey(mood.date) === key);

      return {
        date: key,
        score:
          matches.length > 0
            ? Number((matches.reduce((sum, mood) => sum + mood.score, 0) / matches.length).toFixed(1))
            : null
      };
    });

    const lowestDay = [...weekly]
      .filter((item) => item.score !== null)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];

    const insight = lowestDay
      ? `Your mood was lowest on ${new Date(lowestDay.date).toLocaleDateString("en-IN", {
          weekday: "long"
        })}.`
      : "Log your mood for a few days to unlock AI insights.";

    return {
      averageScore: Number(averageScore.toFixed(1)),
      weekly,
      insight
    };
  }

  static async getEmotionalCalendar(userId: string) {
    const moods = await this.getMoodHistory(userId, 30);

    return moods.map((mood) => ({
      date: toDayKey(mood.date),
      score: mood.score,
      tags: mood.tags,
      note: mood.note
    }));
  }

  private static async updateStreak(userId: string, currentDate: Date) {
    const user = await User.findById(userId);
    if (!user) return;

    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);

    const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
    lastActive?.setHours(0, 0, 0, 0);

    if (!lastActive) {
      user.streak = 1;
    } else {
      const dayDiff = Math.round((today.getTime() - lastActive.getTime()) / (24 * 60 * 60 * 1000));
      if (dayDiff === 0) {
        return;
      }
      user.streak = dayDiff === 1 ? user.streak + 1 : 1;
    }

    user.lastActiveAt = currentDate;
    await user.save();
  }
}
