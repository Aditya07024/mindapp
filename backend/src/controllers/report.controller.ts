import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { User, Mood, JournalEntry, Conversation, SharedReport, AIReport } from "@/models";
import { AppError } from "@/lib/app-error";
import mongoose from "mongoose";

export class ReportController {
  // Helper to fetch report data for a user and date range
  private static async fetchReportData(userId: string, startDate: Date, endDate: Date) {
    const [moods, journals, conversations] = await Promise.all([
      Mood.find({
        userId,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 }).lean(),
      JournalEntry.find({
        userId,
        createdAt: { $gte: startDate, $lte: endDate }
      }).sort({ createdAt: -1 }).lean(),
      Conversation.find({
        userId,
        updatedAt: { $gte: startDate, $lte: endDate }
      }).sort({ updatedAt: -1 }).lean()
    ]);

    const moodScores = moods.map(m => m.score);
    const avgMood = moodScores.length
      ? Number((moodScores.reduce((a, b) => a + b, 0) / moodScores.length).toFixed(1))
      : null;

    // Compile conversation summaries
    const chatSummaries = conversations.map(c => ({
      sessionId: c.sessionId,
      summary: c.summary || (c.messages && c.messages.length > 0 ? c.messages[0].content.slice(0, 100) + "..." : "No messages"),
      riskLevel: c.riskLevel,
      updatedAt: c.updatedAt
    }));

    return {
      avgMood,
      moods: moods.map(m => ({
        id: m._id,
        score: m.score,
        tags: m.tags,
        note: m.note,
        date: m.date
      })),
      journals: journals.map(j => ({
        id: j._id,
        prompt: j.prompt,
        situation: j.situation,
        thought: j.thought,
        feeling: j.feeling,
        reframe: j.reframe,
        aiResponse: j.aiResponse,
        createdAt: j.createdAt
      })),
      chats: chatSummaries
    };
  }

  /** GET /user/report?period=day|week|month */
  static getUserReport = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.sub;
    const period = (req.query.period as string) || "week";

    const now = new Date();
    const endDate = now;
    const startDate = new Date();

    if (period === "day") {
      startDate.setDate(now.getDate() - 1);
    } else if (period === "week") {
      startDate.setDate(now.getDate() - 7);
    } else if (period === "fortnight" || period === "15day") {
      startDate.setDate(now.getDate() - 15);
    } else if (period === "month") {
      startDate.setDate(now.getDate() - 30);
    } else {
      throw new AppError("Invalid period. Must be day, week, fortnight, or month", 400);
    }

    const user = await User.findById(userId).select("fullName tier streak").lean();
    if (!user) throw new AppError("User not found", 404);

    const reportData = await ReportController.fetchReportData(userId, startDate, endDate);

    let normalSummary = "";
    let aiReportInfo: any = null;

    if (period === "week" || period === "fortnight" || period === "15day") {
      const moodCount = reportData.moods?.length || 0;
      const journalCount = reportData.journals?.length || 0;
      const avgMoodVal = reportData.avgMood;
      
      const periodLabel = period === "week" ? "week" : "15 days";
      
      if (moodCount === 0 && journalCount === 0) {
        normalSummary = `You haven't logged any moods or journal entries this past ${periodLabel}. Regular self-reflection can help you track emotional patterns and build mindfulness.`;
      } else {
        const moodPart = moodCount > 0 
          ? `logged ${moodCount} mood check-ins (average score of ${avgMoodVal}/10)`
          : "no mood check-ins";
        const journalPart = journalCount > 0 
          ? `completed ${journalCount} journal entry reflections`
          : "no journal entries";
          
        normalSummary = `Over the past ${periodLabel}, you ${moodPart} and ${journalPart}. Reflecting on your daily thoughts and feelings is a powerful step toward understanding your emotional trends.`;
      }

      const latestReport = await AIReport.findOne({ userId }).sort({ createdAt: -1 });
      if (latestReport) {
        const checkDays = period === "week" ? 7 : 15;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - checkDays);
        if (latestReport.createdAt >= cutoffDate) {
          aiReportInfo = {
            id: latestReport._id,
            paid: latestReport.paid,
            aiAnalysis: latestReport.aiAnalysis || null,
            startDate: latestReport.startDate,
            endDate: latestReport.endDate,
          };
        }
      }
    }

    res.json({
      user: {
        fullName: user.fullName || "Anonymous",
        tier: user.tier,
        streak: user.streak
      },
      period,
      startDate,
      endDate,
      normalSummary: normalSummary || undefined,
      aiReport: aiReportInfo || undefined,
      ...reportData
    });
  });

  /** POST /user/report/share */
  static shareReport = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.sub;
    const { therapistId, period, notes } = req.body as {
      therapistId: string;
      period: "day" | "week" | "fortnight" | "month";
      notes?: string;
    };

    if (!therapistId || !period) {
      throw new AppError("therapistId and period are required", 400);
    }

    // Verify therapist exists and has therapist role
    const therapist = await User.findById(therapistId).select("role therapistProfile").lean();
    if (!therapist || therapist.role !== "therapist") {
      throw new AppError("Therapist not found or invalid role", 404);
    }

    const now = new Date();
    const endDate = now;
    const startDate = new Date();

    if (period === "day") {
      startDate.setDate(now.getDate() - 1);
    } else if (period === "week") {
      startDate.setDate(now.getDate() - 7);
    } else if (period === "fortnight") {
      startDate.setDate(now.getDate() - 15);
    } else if (period === "month") {
      startDate.setDate(now.getDate() - 30);
    } else {
      throw new AppError("Invalid period. Must be day, week, fortnight, or month", 400);
    }

    const sharedReport = await SharedReport.create({
      userId: new mongoose.Types.ObjectId(userId),
      therapistId: new mongoose.Types.ObjectId(therapistId),
      period,
      startDate,
      endDate,
      notes
    });

    res.status(201).json({
      message: "Report shared successfully",
      sharedReportId: sharedReport._id
    });
  });

  /** GET /user/report/shares */
  static getUserShares = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.sub;

    const shares = await SharedReport.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(
      shares.map(async (s) => {
        const therapist = await User.findById(s.therapistId)
          .select("therapistProfile")
          .lean();
        return {
          id: s._id,
          therapistId: s.therapistId,
          therapistName: therapist?.therapistProfile?.name ?? "Therapist",
          period: s.period,
          startDate: s.startDate,
          endDate: s.endDate,
          notes: s.notes,
          sharedAt: s.createdAt
        };
      })
    );

    res.json({ shares: enriched });
  });

  /** GET /therapist/me/shared-reports */
  static getTherapistSharedReports = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const therapistId = req.user!.sub;

    const shares = await SharedReport.find({ therapistId })
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(
      shares.map(async (s) => {
        const user = await User.findById(s.userId)
          .select("fullName phoneMasked")
          .lean();
        return {
          id: s._id,
          userId: s.userId,
          userName: user?.fullName || "Anonymous Patient",
          userPhoneMasked: user?.phoneMasked || "",
          period: s.period,
          startDate: s.startDate,
          endDate: s.endDate,
          notes: s.notes,
          sharedAt: s.createdAt
        };
      })
    );

    res.json({ sharedReports: enriched });
  });

  /** GET /therapist/me/shared-reports/:id */
  static getTherapistSharedReportDetail = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const therapistId = req.user!.sub;
    const { id } = req.params;

    const sharedReport = (await SharedReport.findById(id).lean()) as any;
    if (!sharedReport) {
      throw new AppError("Shared report not found", 404);
    }

    if (String(sharedReport.therapistId) !== therapistId) {
      throw new AppError("Unauthorized access to this shared report", 403);
    }

    const user = await User.findById(sharedReport.userId)
      .select("fullName phoneMasked onboarding")
      .lean();

    const reportData = await ReportController.fetchReportData(
      String(sharedReport.userId),
      sharedReport.startDate,
      sharedReport.endDate
    );

    res.json({
      id: sharedReport._id,
      user: {
        fullName: user?.fullName || "Anonymous Patient",
        phoneMasked: user?.phoneMasked || "",
        onboarding: user?.onboarding || null
      },
      period: sharedReport.period,
      startDate: sharedReport.startDate,
      endDate: sharedReport.endDate,
      notes: sharedReport.notes,
      sharedAt: sharedReport.createdAt,
      ...reportData
    });
  });
}
