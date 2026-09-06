import type { Response, Request } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { MeetingPhoto } from "@/models";
import { AppError } from "@/lib/app-error";
import { getPublicUrlForFilename, deleteFileFromStorage } from "@/middleware/upload.middleware";

export class MeetingPhotoController {
  /**
   * GET /api/meeting-photos
   * Fetch active meeting photos for public landing page
   */
  static getPublicList = asyncHandler(async (_req: Request, res: Response) => {
    const photos = await MeetingPhoto.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    return res.json({ photos });
  });

  /**
   * GET /api/meeting-photos/admin
   * Fetch all meeting photos (Admin)
   */
  static getAdminList = asyncHandler(async (_req: AuthedRequest, res: Response) => {
    const photos = await MeetingPhoto.find()
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    return res.json({ photos });
  });

  /**
   * POST /api/meeting-photos/upload
   * Upload single or multiple meeting photo screenshot files (Admin)
   */
  static uploadPhoto = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    const singleFile = req.file;

    if (!files?.length && !singleFile) {
      throw new AppError("No photo files uploaded", 400);
    }

    const uploadedFiles = files && files.length > 0 ? files : singleFile ? [singleFile] : [];
    const imageUrls = uploadedFiles.map((f) => getPublicUrlForFilename(f.filename, req));

    return res.json({
      message: "Photos uploaded successfully",
      imageUrl: imageUrls[0] || "",
      imageUrls,
    });
  });

  /**
   * POST /api/meeting-photos
   * Create new meeting photo item (Admin)
   */
  static createPhoto = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const {
      title,
      imageUrl,
      imageUrls,
      caption,
      speakerName,
      speakerRole,
      meetingType,
      attendeeCount,
      rating,
      dateText,
      displayOrder,
      isActive,
    } = req.body;

    const finalImageUrls: string[] = Array.isArray(imageUrls) && imageUrls.length > 0
      ? imageUrls.map((u: string) => u.trim()).filter(Boolean)
      : imageUrl ? [imageUrl.trim()] : [];

    if (!title || finalImageUrls.length === 0) {
      throw new AppError("Title and at least one screenshot image are required", 400);
    }

    const photo = await MeetingPhoto.create({
      title: title.trim(),
      imageUrl: finalImageUrls[0],
      imageUrls: finalImageUrls,
      caption: caption ? caption.trim() : "",
      speakerName: speakerName ? speakerName.trim() : "",
      speakerRole: speakerRole ? speakerRole.trim() : "",
      meetingType: meetingType ? meetingType.trim() : "",
      attendeeCount: Number(attendeeCount) || 0,
      rating: rating ? Number(rating) : 5,
      dateText: dateText ? dateText.trim() : "",
      displayOrder: Number(displayOrder) || 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      createdBy: req.user?.sub ? (req.user.sub as any) : null,
    });

    return res.status(201).json({
      message: "Meeting photo entry added successfully",
      photo,
    });
  });

  /**
   * PUT /api/meeting-photos/:id
   * Update existing meeting photo item (Admin)
   */
  static updatePhoto = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const {
      title,
      imageUrl,
      imageUrls,
      caption,
      speakerName,
      speakerRole,
      meetingType,
      attendeeCount,
      rating,
      dateText,
      displayOrder,
      isActive,
    } = req.body;

    const photo = await MeetingPhoto.findById(id);
    if (!photo) {
      throw new AppError("Meeting photo record not found", 404);
    }

    if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
      const cleanUrls = imageUrls.map((u: string) => u.trim()).filter(Boolean);
      photo.imageUrls = cleanUrls;
      photo.imageUrl = cleanUrls[0] || photo.imageUrl;
    } else if (imageUrl !== undefined) {
      photo.imageUrl = imageUrl.trim();
      if (!photo.imageUrls || photo.imageUrls.length === 0) {
        photo.imageUrls = [imageUrl.trim()];
      }
    }

    if (title !== undefined) photo.title = title.trim();
    if (caption !== undefined) photo.caption = caption.trim();
    if (speakerName !== undefined) photo.speakerName = speakerName.trim();
    if (speakerRole !== undefined) photo.speakerRole = speakerRole.trim();
    if (meetingType !== undefined) photo.meetingType = meetingType.trim();
    if (attendeeCount !== undefined) photo.attendeeCount = Number(attendeeCount);
    if (rating !== undefined) photo.rating = Number(rating);
    if (dateText !== undefined) photo.dateText = dateText.trim();
    if (displayOrder !== undefined) photo.displayOrder = Number(displayOrder);
    if (isActive !== undefined) photo.isActive = Boolean(isActive);

    await photo.save();

    return res.json({
      message: "Meeting photo entry updated successfully",
      photo,
    });
  });

  /**
   * DELETE /api/meeting-photos/:id
   * Delete meeting photo item (Admin)
   */
  static deletePhoto = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;

    const photo = await MeetingPhoto.findById(id);
    if (!photo) {
      throw new AppError("Meeting photo record not found", 404);
    }

    const allUrls = photo.imageUrls?.length ? photo.imageUrls : [photo.imageUrl];
    allUrls.forEach((url) => {
      if (url && url.includes("/uploads/images/")) {
        deleteFileFromStorage(url);
      }
    });

    await photo.deleteOne();

    return res.json({
      message: "Meeting photo deleted successfully",
      id,
    });
  });
}
