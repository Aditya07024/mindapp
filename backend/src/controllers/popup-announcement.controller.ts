import type { Response, Request } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { PopupAnnouncement } from "@/models";
import { AppError } from "@/lib/app-error";
import { getPublicUrlForFilename, deleteFileFromStorage } from "@/middleware/upload.middleware";

export class PopupAnnouncementController {
  /**
   * GET /api/popup-announcement/active
   * Fetch active popup announcement for public landing page
   */
  static getActive = asyncHandler(async (_req: Request, res: Response) => {
    const announcement = await PopupAnnouncement.findOne({ isActive: true })
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ announcement: announcement || null });
  });

  /**
   * GET /api/popup-announcement
   * Fetch announcement configuration (Admin)
   */
  static getConfig = asyncHandler(async (_req: AuthedRequest, res: Response) => {
    let announcement = await PopupAnnouncement.findOne().sort({ updatedAt: -1 });

    if (!announcement) {
      // Create a default initial configuration document if none exists
      announcement = await PopupAnnouncement.create({
        title: "Upcoming MindSync Workshop",
        badgeText: "Live Workshop",
        description: "Join our expert therapists for an interactive live workshop on mental wellness, stress management, and mindfulness.",
        dateText: "Upcoming Event",
        conferenceUrl: "/conferences",
        buttonText: "Go to Conference Page",
        isActive: true,
      });
    }

    return res.json({ announcement });
  });

  /**
   * POST /api/popup-announcement
   * Update or create announcement configuration (Admin)
   */
  static updateConfig = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const {
      title,
      badgeText,
      description,
      dateText,
      posterUrl,
      conferenceUrl,
      conferenceId,
      buttonText,
      isActive,
    } = req.body;

    if (!title || !description) {
      throw new AppError("Title and description are required fields", 400);
    }

    let announcement = await PopupAnnouncement.findOne().sort({ updatedAt: -1 });

    const updateData: any = {
      title: title.trim(),
      badgeText: badgeText ? badgeText.trim() : "Live Workshop",
      description: description.trim(),
      dateText: dateText ? dateText.trim() : "Coming Soon",
      posterUrl: posterUrl !== undefined ? posterUrl : announcement?.posterUrl || null,
      conferenceUrl: conferenceUrl ? conferenceUrl.trim() : "/conferences",
      conferenceId: conferenceId || null,
      buttonText: buttonText ? buttonText.trim() : "Go to Conference Page",
      isActive: Boolean(isActive),
      updatedBy: req.user?.sub ? (req.user.sub as any) : null,
    };

    if (announcement) {
      // If poster image was replaced or cleared, delete old file if it's no longer used
      if (announcement.posterUrl && announcement.posterUrl !== updateData.posterUrl) {
        deleteFileFromStorage(announcement.posterUrl);
      }
      Object.assign(announcement, updateData);
      await announcement.save();
    } else {
      announcement = await PopupAnnouncement.create(updateData);
    }

    return res.json({
      message: "Popup announcement updated successfully",
      announcement,
    });
  });

  /**
   * POST /api/popup-announcement/upload-poster
   * Upload poster image file (Admin)
   */
  static uploadPoster = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const file = req.file;
    if (!file) {
      throw new AppError("No poster image file uploaded", 400);
    }

    const posterUrl = getPublicUrlForFilename(file.filename, req);

    return res.json({
      message: "Poster uploaded successfully",
      posterUrl,
      filename: file.filename,
    });
  });
}
