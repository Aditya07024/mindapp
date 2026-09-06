import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { AppError } from "@/lib/app-error";
import { JournalService } from "@/services/journal.service";

export class JournalController {
  static createEntry = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { prompt, situation, thought, feeling, reframe } = req.body;

    try {
      const entry = await JournalService.createJournalEntry(
        req.user!.sub,
        prompt,
        situation,
        thought,
        feeling,
        reframe
      );

      res.status(201).json({ entry });
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : "Failed to create journal entry", 400);
    }
  });

  static getEntries = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const entries = await JournalService.getJournalEntries(req.user!.sub);
    res.json({ entries });
  });

  static getAnalytics = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const analytics = await JournalService.getJournalAnalytics(req.user!.sub);
    res.json(analytics);
  });

  static getRandomPrompt = asyncHandler(async (_req: AuthedRequest, res: Response) => {
    res.json({ prompt: JournalService.getRandomPrompt() });
  });
}
