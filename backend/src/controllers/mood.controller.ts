import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { MoodService } from "@/services/mood.service";

export class MoodController {
  static recordMood = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { score, tags = [], note } = req.body;
    const moodEntry = await MoodService.recordMood(req.user!.sub, score, tags, note);
    res.status(201).json({ moodEntry });
  });

  static getMoodHistory = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const days = Number(req.query.days ?? 30);
    const moods = await MoodService.getMoodHistory(req.user!.sub, days);
    res.json({ moods });
  });

  static getMoodTrends = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const trends = await MoodService.getMoodTrends(req.user!.sub);
    res.json(trends);
  });

  static getEmotionalCalendar = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const calendar = await MoodService.getEmotionalCalendar(req.user!.sub);
    res.json({ calendar });
  });
}
