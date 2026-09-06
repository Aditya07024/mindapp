import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { Conference, ConferenceRegistration, ConferencePayment, User } from "@/models";
import { AppError } from "@/lib/app-error";
import PaymentService from "@/services/payment.service";
import { JaasService } from "@/services/jaas.service";
import { getPublicUrlForFilename, deleteFileFromStorage } from "@/middleware/upload.middleware";
import mongoose from "mongoose";
import * as XLSX from "xlsx";

function slugifyRoomName(title: string): string {
  const clean = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${clean || "conference"}-${random}`;
}

export function isValidTeamsUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "teams.microsoft.com" ||
      host.endsWith(".teams.microsoft.com") ||
      host === "teams.live.com" ||
      host.endsWith(".teams.live.com") ||
      host === "teams.microsoft.us"
    );
  } catch {
    return false;
  }
}

export function isValidGoogleMeetUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "meet.google.com" ||
      host.endsWith(".meet.google.com") ||
      host === "meet.google.co.in" ||
      (host.endsWith(".google.com") && host.startsWith("meet"))
    );
  } catch {
    return false;
  }
}

export function isValidWhatsAppUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "chat.whatsapp.com" ||
      host.endsWith(".whatsapp.com") ||
      host === "wa.me" ||
      host.endsWith(".wa.me")
    );
  } catch {
    return false;
  }
}

export function formatHostEmails(emailStr?: any): string {
  if (!emailStr) return "";
  return String(emailStr)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .join(", ");
}

import { clerkClient } from "@clerk/express";

export async function isUserAdminOrDelegated(req: AuthedRequest): Promise<boolean> {
  if (!req.user) return false;
  if (["super_admin", "admin", "org_admin"].includes(req.user.role)) return true;

  try {
    const { DelegatedAccess } = await import("@/models/delegated-access");
    const dbUser: any = await User.findById(req.user.sub).select("email phoneMasked therapistProfile role");

    let clerkEmail = "";
    if (req.user.clerkId) {
      try {
        const clerkUser = await clerkClient.users.getUser(req.user.clerkId);
        clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress || "";
      } catch (e) {}
    }

    const possibleEmails = [
      clerkEmail,
      dbUser?.email,
      dbUser?.phoneMasked,
      dbUser?.therapistProfile?.email,
    ]
      .filter(Boolean)
      .map((e: string) => String(e).toLowerCase().trim());

    for (const email of possibleEmails) {
      if (email) {
        const access: any = await DelegatedAccess.findOne({ email });
        if (access && (access.isFullAdmin || access.canHostMeeting || access.canViewRegistrations)) {
          return true;
        }
      }
    }
  } catch (err) {
    console.error("Error in isUserAdminOrDelegated:", err);
  }
  return false;
}

export class ConferenceController {
  /**
   * POST /api/conferences - Create conference (Admin)
   */
  static createConference = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const {
        title,
        description,
        banner,
        posterUrl,
        meetingDate,
        meetingTime,
        endTime,
        platform,
        meetingLink,
        duration,
        category,
        meetingType,
        priceType,
        price,
        maxParticipants,
        enableWaitingRoom,
        enableRecording,
        enablePassword,
        password,
        hostEmail,
        roomName,
        autoGenerateRoomName,
        instructions,
        status,
        isPinned,
      } = req.body;

      if (!title || !description || !meetingDate || !meetingTime) {
        throw new AppError("Title, description, date, and time are required", 400);
      }

      const selectedPlatform = platform === "teams" ? "teams" : platform === "google_meet" || platform === "google-meet" ? "google_meet" : "jitsi";
      const cleanMeetingLink = (meetingLink || "").trim();

      if (selectedPlatform === "teams") {
        if (!cleanMeetingLink) {
          throw new AppError("Meeting Link is required for Microsoft Teams meetings.", 400);
        }
        if (!isValidTeamsUrl(cleanMeetingLink)) {
          throw new AppError("Invalid Microsoft Teams meeting URL. Please enter a valid Teams meeting link.", 400);
        }
      } else if (selectedPlatform === "google_meet") {
        if (!cleanMeetingLink) {
          throw new AppError("Meeting Link is required for Google Meet meetings.", 400);
        }
        if (!isValidGoogleMeetUrl(cleanMeetingLink)) {
          throw new AppError("Invalid Google Meet meeting URL. Please enter a valid Google Meet link (e.g., https://meet.google.com/abc-defg-hij).", 400);
        }
      }

      let finalRoomName = roomName;
      if (autoGenerateRoomName || !finalRoomName || finalRoomName.trim() === "") {
        finalRoomName = slugifyRoomName(title);
      } else {
        finalRoomName = finalRoomName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      }

      // Ensure roomName is unique
      const existing = await Conference.findOne({ roomName: finalRoomName });
      if (existing) {
        finalRoomName = `${finalRoomName}-${Date.now().toString().slice(-4)}`;
      }

      const numPrice = priceType === "free" ? 0 : Number(price || 0);

      const conference = await Conference.create({
        title,
        description,
        banner: banner || "",
        posterUrl: posterUrl || null,
        roomName: finalRoomName,
        meetingDate,
        meetingTime,
        endTime: endTime || "",
        platform: selectedPlatform,
        meetingLink: cleanMeetingLink,
        duration: Number(duration || 60),
        category: category || "",
        meetingType: meetingType || "public",
        priceType: priceType || "free",
        price: numPrice,
        maxParticipants: Number(maxParticipants || 100),
        enableWaitingRoom: Boolean(enableWaitingRoom),
        enableRecording: Boolean(enableRecording),
        enablePassword: Boolean(enablePassword),
        password: password || "",
        hostEmail: formatHostEmails(hostEmail),
        instructions: instructions || "",
        status: status || "published",
        isPinned: Boolean(isPinned),
        pinnedAt: isPinned ? new Date() : undefined,
        createdBy: new mongoose.Types.ObjectId(req.user!.sub),
      });

      res.status(201).json({
        message: "Conference created successfully",
        conference,
      });
    }
  );

  /**
   * GET /api/conferences
   * List all conferences with optional filters & search
   */
  static getAllConferences = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { category, search, status, type } = req.query as Record<string, string>;

      // Ensure legacy documents without status field are marked published
      await Conference.updateMany({ status: { $exists: false } }, { $set: { status: "published" } });

      const query: any = {};

      // Non-admins see all published, live, upcoming, ended or un-drafted conferences
      const isAdmin = await isUserAdminOrDelegated(req);
      if (!isAdmin) {
        query.status = { $ne: "draft" };
      } else if (status && status !== "all") {
        query.status = status;
      }

      if (category && category !== "All") {
        query.category = category;
      }

      if (type && type !== "All") {
        query.meetingType = type;
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { category: { $regex: search, $options: "i" } },
        ];
      }

      const conferences = await Conference.find(query)
        .populate("createdBy", "fullName email")
        .sort({ isPinned: -1, pinnedAt: -1, createdAt: -1, meetingDate: 1 })
        .lean();

      // Enhance with registration counts & computed status
      const now = new Date();
      const enhanced = await Promise.all(
        conferences.map(async (conf) => {
          const registeredCount = await ConferenceRegistration.countDocuments({
            conferenceId: conf._id,
            paymentStatus: { $in: ["free", "paid"] },
          });

          // Check user registration if authed
          let userRegistration = null;
          if (req.user?.sub) {
            userRegistration = await ConferenceRegistration.findOne({
              conferenceId: conf._id,
              userId: req.user.sub,
            }).lean();
          }

          // Calculate computed status (upcoming, live, ended)
          let computedStatus = conf.status === "draft" ? "draft" : "published";
          try {
            const rawDate = conf.meetingDate ? String(conf.meetingDate) : "";
            const dateOnlyStr = rawDate.includes("T") ? rawDate.split("T")[0] : rawDate;
            const timeStr = conf.meetingTime || "00:00";
            const startDateTime = new Date(`${dateOnlyStr}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}`);
            const endDateTime = new Date(startDateTime.getTime() + (conf.duration || 60) * 60 * 1000);

            if (!isNaN(startDateTime.getTime())) {
              if (now >= startDateTime && now <= endDateTime) {
                computedStatus = "live";
              } else if (now > endDateTime) {
                computedStatus = conf.status === "draft" ? "draft" : "ended";
              } else if (conf.status !== "draft") {
                computedStatus = "upcoming";
              }
            }
          } catch (e) {
            // fallback
          }

          return {
            ...conf,
            registeredCount,
            computedStatus,
            isUserRegistered: Boolean(userRegistration && ["free", "paid"].includes(userRegistration.paymentStatus)),
            userRegistrationStatus: userRegistration ? userRegistration.paymentStatus : null,
          };
        })
      );

      res.json(enhanced);
    }
  );

  /**
   * GET /api/conferences/:id - Get single conference
   */
  static getConferenceById = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid conference ID", 400);
      }

      const conference = await Conference.findById(id)
        .populate("createdBy", "fullName email")
        .lean();

      if (!conference) {
        throw new AppError("Conference not found", 404);
      }

      const registeredCount = await ConferenceRegistration.countDocuments({
        conferenceId: conference._id,
        paymentStatus: { $in: ["free", "paid"] },
      });

      let userRegistration = null;
      if (req.user?.sub) {
        userRegistration = await ConferenceRegistration.findOne({
          conferenceId: conference._id,
          userId: req.user.sub,
        }).lean();
      }

      const now = new Date();
      let computedStatus = conference.status;
      try {
        const startDateTime = new Date(`${conference.meetingDate}T${conference.meetingTime}:00`);
        const endDateTime = new Date(startDateTime.getTime() + conference.duration * 60 * 1000);
        if (now >= startDateTime && now <= endDateTime) {
          computedStatus = "live";
        } else if (now > endDateTime) {
          computedStatus = "ended";
        } else {
          computedStatus = "upcoming";
        }
      } catch (e) {
        // fallback
      }

      res.json({
        ...conference,
        registeredCount,
        computedStatus,
        isUserRegistered: Boolean(userRegistration && ["free", "paid"].includes(userRegistration.paymentStatus)),
        userRegistrationStatus: userRegistration ? userRegistration.paymentStatus : null,
      });
    }
  );

  /**
   * POST /api/conferences/upload-poster - Upload conference poster image (Admin)
   */
  static uploadPoster = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      if (!req.file) {
        throw new AppError("No poster image file provided", 400);
      }

      const posterUrl = getPublicUrlForFilename(req.file.filename, req);

      res.status(200).json({
        message: "Poster uploaded successfully",
        posterUrl,
        filename: req.file.filename,
      });
    }
  );

  /**
   * POST /api/conferences/:id/poster - Upload/update conference poster by conference ID (Admin)
   */
  static uploadConferencePosterById = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.file) deleteFileFromStorage(req.file.filename);
        throw new AppError("Invalid conference ID", 400);
      }

      if (!req.file) {
        throw new AppError("No poster image file provided", 400);
      }

      const conference = await Conference.findById(id);
      if (!conference) {
        if (req.file) deleteFileFromStorage(req.file.filename);
        throw new AppError("Conference not found", 404);
      }

      // Clean up old poster file if replacing
      if (conference.posterUrl) {
        deleteFileFromStorage(conference.posterUrl);
      }

      const newPosterUrl = getPublicUrlForFilename(req.file.filename, req);
      conference.posterUrl = newPosterUrl;
      await conference.save();

      res.status(200).json({
        message: "Poster updated successfully",
        posterUrl: newPosterUrl,
        conference,
      });
    }
  );

  /**
   * PUT /api/conferences/:id - Update conference (Admin)
   */
  static updateConference = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid conference ID", 400);
      }

      const conference = await Conference.findById(id);
      if (!conference) {
        throw new AppError("Conference not found", 404);
      }

      const updates = req.body;
      if (updates.priceType === "free") {
        updates.price = 0;
      }
      if (updates.hostEmail !== undefined) {
        updates.hostEmail = formatHostEmails(updates.hostEmail);
      }
      if (updates.isPinned !== undefined) {
        updates.isPinned = Boolean(updates.isPinned);
        updates.pinnedAt = updates.isPinned ? new Date() : null;
      }

      // If posterUrl is being removed or replaced via body edit
      if (updates.posterUrl !== undefined && updates.posterUrl !== conference.posterUrl && conference.posterUrl) {
        deleteFileFromStorage(conference.posterUrl);
      }

      const targetPlatform = updates.platform !== undefined ? updates.platform : conference.platform;
      const targetMeetingLink = updates.meetingLink !== undefined ? String(updates.meetingLink).trim() : (conference.meetingLink || "").trim();

      if (targetPlatform === "teams") {
        if (!targetMeetingLink) {
          throw new AppError("Meeting Link is required for Microsoft Teams meetings.", 400);
        }
        if (!isValidTeamsUrl(targetMeetingLink)) {
          throw new AppError("Invalid Microsoft Teams meeting URL. Please enter a valid Teams meeting link.", 400);
        }
        updates.meetingLink = targetMeetingLink;
      } else if (targetPlatform === "google_meet" || targetPlatform === "google-meet") {
        updates.platform = "google_meet";
        if (!targetMeetingLink) {
          throw new AppError("Meeting Link is required for Google Meet meetings.", 400);
        }
        if (!isValidGoogleMeetUrl(targetMeetingLink)) {
          throw new AppError("Invalid Google Meet meeting URL. Please enter a valid Google Meet link (e.g., https://meet.google.com/abc-defg-hij).", 400);
        }
        updates.meetingLink = targetMeetingLink;
      } else if (targetPlatform === "jitsi") {
        updates.meetingLink = "";
      }

      Object.assign(conference, updates);
      await conference.save();

      res.json({
        message: "Conference updated successfully",
        conference,
      });
    }
  );

  /**
   * DELETE /api/conferences/:id - Delete conference (Admin)
   */
  static deleteConference = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid conference ID", 400);
      }

      const conference = await Conference.findById(id);
      if (!conference) {
        throw new AppError("Conference not found", 404);
      }

      // Delete poster file if present
      if (conference.posterUrl) {
        deleteFileFromStorage(conference.posterUrl);
      }

      await Conference.deleteOne({ _id: id });
      await ConferenceRegistration.deleteMany({ conferenceId: id });
      await ConferencePayment.deleteMany({ conferenceId: id });

      res.json({ message: "Conference deleted successfully" });
    }
  );

  /**
   * PATCH /api/conferences/:id/publish - Toggle publish/draft status (Admin)
   */
  static togglePublish = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;
      const { status } = req.body as { status: "published" | "draft" };

      const conference = await Conference.findById(id);
      if (!conference) throw new AppError("Conference not found", 404);

      conference.status = status || (conference.status === "published" ? "draft" : "published");
      await conference.save();

      res.json({
        message: `Conference ${conference.status === "published" ? "published" : "unpublished"} successfully`,
        conference,
      });
    }
  );

  /**
   * PATCH /api/conferences/:id/pin - Toggle pin status to pin meeting to top (Admin)
   */
  static togglePin = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;
      const { isPinned } = req.body as { isPinned?: boolean };

      const conference = await Conference.findById(id);
      if (!conference) throw new AppError("Conference not found", 404);

      const targetPinned = typeof isPinned === "boolean" ? isPinned : !conference.isPinned;
      conference.isPinned = targetPinned;
      conference.pinnedAt = targetPinned ? new Date() : (undefined as any);
      await conference.save();

      res.json({
        message: conference.isPinned ? "Meeting pinned to top" : "Meeting unpinned",
        isPinned: conference.isPinned,
        conference,
      });
    }
  );

  /**
   * POST /api/conferences/register - Register user for conference
   */
  static registerConference = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { conferenceId, fullName, age, email, phone } = req.body;

      if (!conferenceId || !fullName || !age || !email) {
        throw new AppError("Full name, age, email, and conferenceId are required", 400);
      }

      const numAge = Number(age);
      if (isNaN(numAge) || numAge <= 0 || numAge > 120) {
        throw new AppError("Please provide a valid age", 400);
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError("Please provide a valid email address", 400);
      }

      const conference = await Conference.findById(conferenceId);
      if (!conference) {
        throw new AppError("Conference not found", 404);
      }

      // Check seat limit
      const currentRegs = await ConferenceRegistration.countDocuments({
        conferenceId,
        paymentStatus: { $in: ["free", "paid"] },
      });

      if (currentRegs >= conference.maxParticipants) {
        throw new AppError("This conference is fully booked!", 400);
      }

      const cleanEmail = email.toLowerCase().trim();
      const userId = req.user?.sub ? new mongoose.Types.ObjectId(req.user.sub) : new mongoose.Types.ObjectId();

      // Check existing registration
      let registration = await ConferenceRegistration.findOne({
        conferenceId,
        $or: req.user?.sub
          ? [{ userId }, { email: cleanEmail }]
          : [{ email: cleanEmail }],
      });

      // Determine Host / Leader Role:
      const isCreator = req.user?.sub && String(conference.createdBy) === String(req.user.sub);
      const hostEmailsList = conference.hostEmail
        ? conference.hostEmail.split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean)
        : [];
      const isDesignatedHost = Boolean(cleanEmail && hostEmailsList.includes(cleanEmail));
      const isAdmin = await isUserAdminOrDelegated(req);
      const isHost = Boolean(isAdmin || isCreator || isDesignatedHost);

      // Check if user is Allowed by Admin into Meeting or Waiting Room:
      const isAdmittedToMeeting = Boolean(
        registration && (registration.admitted === true || registration.admitStatus === "admitted")
      );
      const isAllowedInWaitingRoom = Boolean(
        registration && (registration.currentStatus === "waiting" || registration.admitStatus === "waiting")
      );
      const isAllowedByAdmin = isAdmittedToMeeting || isAllowedInWaitingRoom;

      if (registration && ["free", "paid"].includes(registration.paymentStatus)) {
        return res.json({
          message: "You are already registered for this conference",
          registration,
          isAlreadyRegistered: true,
          isPaid: false,
          isHost,
          isAllowedByAdmin,
          roomName: conference.roomName,
          platform: conference.platform || "jitsi",
          meetingLink: conference.meetingLink || "",
        });
      }

      if (isHost || isAllowedByAdmin) {
        if (!registration) {
          registration = await ConferenceRegistration.create({
            conferenceId: conference._id,
            userId,
            fullName,
            age: numAge,
            email: cleanEmail,
            phone: phone || "",
            paymentStatus: "free",
            paymentAmount: 0,
            currentStatus: isAdmittedToMeeting || isHost ? "registered" : "waiting",
            approvalStatus: "approved",
            admitted: isAdmittedToMeeting || isHost,
            admitStatus: isAdmittedToMeeting || isHost ? "admitted" : "waiting",
          });
        } else {
          registration.fullName = fullName;
          registration.age = numAge;
          registration.phone = phone || "";
          if (isAdmittedToMeeting || isHost) {
            registration.admitted = true;
            registration.admitStatus = "admitted";
          }
          await registration.save();
        }

        return res.json({
          message: isHost
            ? "Welcome Host! Entering conference room..."
            : isAdmittedToMeeting
            ? "Allowed by Admin! Entering conference room..."
            : "Allowed into Waiting Room! Redirecting...",
          registration,
          isAlreadyRegistered: true,
          isPaid: false,
          isHost,
          isAllowedByAdmin,
          roomName: conference.roomName,
          platform: conference.platform || "jitsi",
          meetingLink: conference.meetingLink || "",
        });
      }

      // Check if user is linked to an organization with fee coverage
      let isOrgMember = false;
      try {
        const { Organization } = await import("@/models/organization");
        const dbUser = req.user?.sub ? await User.findById(req.user.sub).select("orgId phoneMasked email") : null;
        const userOrg = (dbUser?.orgId ? await Organization.findById(dbUser.orgId) : null) ||
                        await Organization.findOne({ allowedEmails: cleanEmail, verificationStatus: "verified" });
        if (userOrg) isOrgMember = true;
      } catch (e) {
        // ignore
      }

      const isFree = conference.priceType === "free" || conference.price === 0 || isOrgMember;

      if (isFree) {
        if (!registration) {
          registration = await ConferenceRegistration.create({
            conferenceId: conference._id,
            userId,
            fullName,
            age: numAge,
            email: email.toLowerCase(),
            phone: phone || "",
            paymentStatus: "free",
            paymentAmount: 0,
            currentStatus: "registered",
            approvalStatus: "approved",
          });
        } else {
          registration.fullName = fullName;
          registration.age = numAge;
          registration.phone = phone || "";
          registration.paymentStatus = "free";
          registration.paymentAmount = 0;
          await registration.save();
        }

        return res.json({
          message: "Registration successful!",
          registration,
          isPaid: false,
          roomName: conference.roomName,
          platform: conference.platform || "jitsi",
          meetingLink: conference.meetingLink || "",
        });
      }

      // PAID CONFERENCE: Create or update pending registration and generate Razorpay order
      if (!registration) {
        registration = await ConferenceRegistration.create({
          conferenceId: conference._id,
          userId,
          fullName,
          age: numAge,
          email: email.toLowerCase(),
          phone: phone || "",
          paymentStatus: "pending",
          paymentAmount: conference.price,
          currentStatus: "registered",
          approvalStatus: "approved",
        });
      } else {
        // Check if existing registration was paid on Razorpay
        const existingPayment = await ConferencePayment.findOne({ registrationId: registration._id });
        if (existingPayment?.razorpayOrderId) {
          const { isPaid, paymentId } = await PaymentService.isOrderPaid(existingPayment.razorpayOrderId);
          if (isPaid) {
            registration.paymentStatus = "paid";
            registration.paymentAmount = conference.price;
            await registration.save();
            existingPayment.status = "paid";
            if (paymentId) existingPayment.razorpayPaymentId = paymentId;
            await existingPayment.save();

            return res.json({
              message: "Payment confirmed! Welcome to the conference.",
              registration,
              isAlreadyRegistered: true,
              isPaid: true,
              roomName: conference.roomName,
              platform: conference.platform || "jitsi",
              meetingLink: conference.meetingLink || "",
            });
          }
        }

        registration.fullName = fullName;
        registration.age = numAge;
        registration.phone = phone || "";
        registration.paymentStatus = "pending";
        registration.paymentAmount = conference.price;
        await registration.save();
      }

      // Create Razorpay Order (with fallback to free entry if order creation fails)
      try {
        const order = await PaymentService.createOrder({
          amount: conference.price,
          bookingId: `conf_${registration._id}`,
          userEmail: email,
          userName: fullName,
        });

        await ConferencePayment.create({
          conferenceId: conference._id,
          registrationId: registration._id,
          userId,
          razorpayOrderId: order.orderId,
          amount: conference.price,
          currency: "INR",
          status: "created",
        });

        return res.json({
          message: "Registration recorded. Please complete payment.",
          registration,
          isPaid: true,
          orderId: order.orderId,
          amount: conference.price,
          currency: "INR",
          keyId: process.env.RAZORPAY_KEY_ID || "",
          roomName: conference.roomName,
          platform: conference.platform || "jitsi",
          meetingLink: conference.meetingLink || "",
        });
      } catch (paymentErr) {
        console.warn("Razorpay order creation fallback to free entry:", paymentErr);
        registration.paymentStatus = "free";
        registration.paymentAmount = 0;
        await registration.save();

        return res.json({
          message: "Registration successful!",
          registration,
          isPaid: false,
          roomName: conference.roomName,
          platform: conference.platform || "jitsi",
          meetingLink: conference.meetingLink || "",
        });
      }
    }
  );

  /**
   * POST /api/payments/conference/verify - Verify Razorpay payment signature
   */
  static verifyPayment = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { conferenceId, orderId, paymentId, signature } = req.body;

      if (!conferenceId || !orderId || !paymentId || !signature) {
        throw new AppError("Missing payment verification details", 400);
      }

      const isValid = PaymentService.verifyPaymentSignature(orderId, paymentId, signature);
      if (!isValid) {
        throw new AppError("Invalid payment signature", 400);
      }

      const conference = await Conference.findById(conferenceId);
      if (!conference) throw new AppError("Conference not found", 404);

      let registration = null;

      // 1. Try finding registration by payment record orderId
      const payment = await ConferencePayment.findOne({ razorpayOrderId: orderId });
      if (payment && payment.registrationId) {
        registration = await ConferenceRegistration.findById(payment.registrationId);
      }

      // 2. If not found by orderId and user is logged in, try finding by userId
      if (!registration && req.user?.sub) {
        const rawUserId = req.user.sub;
        const userId = mongoose.Types.ObjectId.isValid(rawUserId)
          ? new mongoose.Types.ObjectId(rawUserId)
          : rawUserId;

        registration = await ConferenceRegistration.findOne({
          conferenceId,
          $or: [{ userId }, { userId: rawUserId }],
        });
      }

      if (!registration) throw new AppError("Registration record not found", 404);

      registration.paymentStatus = "paid";
      registration.paymentAmount = conference.price;
      await registration.save();

      // Update payment record
      await ConferencePayment.findOneAndUpdate(
        { razorpayOrderId: orderId },
        {
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
          status: "paid",
        }
      );

      res.json({
        message: "Payment verified successfully!",
        registration,
        roomName: conference.roomName,
      });
    }
  );

  /**
   * POST /api/conferences/:id/sync-payment - Verify pending registration with Razorpay
   */
  static syncPayment = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;
      const emailParam = (req.body.email || req.query.email as string)?.toLowerCase().trim();
      const userId = req.user?.sub ? new mongoose.Types.ObjectId(req.user.sub) : null;

      let registration = null;
      if (userId) {
        registration = await ConferenceRegistration.findOne({ conferenceId: id, userId });
      }
      if (!registration && emailParam) {
        registration = await ConferenceRegistration.findOne({ conferenceId: id, email: emailParam });
      }

      if (!registration) {
        throw new AppError("No registration record found for this conference", 404);
      }

      if (["free", "paid"].includes(registration.paymentStatus)) {
        return res.json({
          message: "Registration payment is confirmed!",
          paymentStatus: registration.paymentStatus,
          registration,
        });
      }

      const payment = await ConferencePayment.findOne({ registrationId: registration._id });
      if (payment?.razorpayOrderId) {
        const { isPaid, paymentId } = await PaymentService.isOrderPaid(payment.razorpayOrderId);
        if (isPaid) {
          registration.paymentStatus = "paid";
          await registration.save();
          payment.status = "paid";
          if (paymentId) payment.razorpayPaymentId = paymentId;
          await payment.save();

          return res.json({
            message: "Payment verified with Razorpay! Status updated to paid.",
            paymentStatus: "paid",
            registration,
          });
        }
      }

      res.json({
        message: "Payment is still pending",
        paymentStatus: registration.paymentStatus,
        registration,
      });
    }
  );

  /**
   * GET /api/conferences/:id/join - Get join details for registered user
   */
  static getJoinInfo = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid conference ID", 400);
      }

      const conference = await Conference.findById(id).lean();
      if (!conference) throw new AppError("Conference not found", 404);

      const emailParam = (req.query.email as string)?.toLowerCase().trim();
      const providedPassword = (req.query.password as string)?.trim();
      const userId = req.user?.sub ? new mongoose.Types.ObjectId(req.user.sub) : null;

      let registration = null;
      if (userId) {
        registration = await ConferenceRegistration.findOne({ conferenceId: id, userId }).lean();
      }
      if (!registration && emailParam) {
        registration = await ConferenceRegistration.findOne({ conferenceId: id, email: emailParam }).lean();
      }

      const isAdmin = await isUserAdminOrDelegated(req);

      // Check if meeting time has passed (ended)
      const now = new Date();
      let endDateTime: Date | null = null;
      try {
        const dateOnlyStr = conference.meetingDate ? String(conference.meetingDate).split("T")[0] : "";
        const timeStr = conference.meetingTime || "00:00";
        const startDateTime = new Date(`${dateOnlyStr}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}`);
        if (!isNaN(startDateTime.getTime())) {
          endDateTime = new Date(startDateTime.getTime() + (conference.duration || 60) * 60 * 1000);
          if (now.getTime() > endDateTime.getTime()) {
            throw new AppError("This scheduled meeting has already ended.", 403);
          }
        }
      } catch (err: any) {
        if (err instanceof AppError) throw err;
      }

      const dbUser = userId ? await User.findById(userId).lean() : null;
      const participantName = registration?.fullName || dbUser?.fullName || (req.user as any)?.fullName || "Participant";
      const participantEmail = (registration?.email || (dbUser as any)?.email || emailParam || (req.user as any)?.email || "").toLowerCase().trim();

      // Determine Host / Leader Role:
      // User is host if they are admin, creator of the conference, or match designated hostEmail(s)
      const isCreator = req.user?.sub && String(conference.createdBy) === String(req.user.sub);
      const hostEmailsList = conference.hostEmail
        ? conference.hostEmail.split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean)
        : [];
      const isDesignatedHost = Boolean(participantEmail && hostEmailsList.includes(participantEmail.toLowerCase().trim()));
      const isHost = Boolean(isAdmin || isCreator || isDesignatedHost);

      if (!registration && !isHost) {
        throw new AppError("You are not registered for this conference. Please register first.", 403);
      }

      if (registration && registration.approvalStatus === "rejected") {
        throw new AppError("Your registration for this conference was rejected by the admin.", 403);
      }

      const isAdmittedByAdmin = registration?.admitted === true || registration?.admitStatus === "admitted";
      const isAllowedInWaitingRoom = registration?.currentStatus === "waiting" || registration?.admitStatus === "waiting";
      if (registration && !isAdmittedByAdmin && !isAllowedInWaitingRoom && !["free", "paid"].includes(registration.paymentStatus) && !isHost && !conference.enableWaitingRoom) {
        // Auto-check Razorpay API for order payment status
        const payment = await ConferencePayment.findOne({ registrationId: registration._id });
        if (payment?.razorpayOrderId) {
          const { isPaid, paymentId } = await PaymentService.isOrderPaid(payment.razorpayOrderId);
          if (isPaid) {
            await ConferenceRegistration.findByIdAndUpdate(registration._id, { paymentStatus: "paid" });
            registration.paymentStatus = "paid";
            payment.status = "paid";
            if (paymentId) payment.razorpayPaymentId = paymentId;
            await payment.save();
          } else {
            throw new AppError("Payment pending. Please complete your registration payment to join.", 403);
          }
        } else {
          throw new AppError("Payment pending. Please complete your registration payment to join.", 403);
        }
      }

      // Check password if enabled and user is not host/admin
      if (conference.enablePassword && conference.password && conference.password.trim() !== "") {
        if (!isHost && providedPassword !== conference.password.trim()) {
          return res.status(401).json({
            requiresPassword: true,
            message: "Password required to join this conference.",
          });
        }
      }

      // Handle Waiting Room logic:
      if (isHost) {
        // Mark hostJoined = true when host joins
        if (!conference.hostJoined) {
          await Conference.updateOne({ _id: id }, { $set: { hostJoined: true } });
          conference.hostJoined = true;
        }
        if (registration) {
          await ConferenceRegistration.updateOne(
            { _id: registration._id },
            { $set: { admitted: true, admitStatus: "admitted" } }
          );
        }
      } else if (conference.enableWaitingRoom) {
        if (registration?.admitStatus === "denied") {
          throw new AppError("You were denied entry to this conference room by the host.", 403);
        }

        const isAdmitted = registration?.admitted === true || registration?.admitStatus === "admitted";
        if (!isAdmitted) {
          if (registration) {
            await ConferenceRegistration.updateOne(
              { _id: registration._id },
              { $set: { currentStatus: "waiting", admitStatus: "waiting", admitted: false } }
            );
          }

          return res.json({
            waitingForHost: true,
            waitingForAdminApproval: true,
            message: "The meeting host or admin must allow you into the room. Please wait in the lobby.",
            conference: {
              id: conference._id,
              title: conference.title,
              description: conference.description,
              roomName: conference.roomName,
              enableWaitingRoom: true,
              meetingDate: conference.meetingDate,
              meetingTime: conference.meetingTime,
              duration: conference.duration,
              endDateTime: endDateTime ? endDateTime.toISOString() : null,
              hostEmail: conference.hostEmail || "",
              hostJoined: conference.hostJoined || false,
              isHost: false,
            },
            user: {
              fullName: participantName,
              email: participantEmail,
              isHost: false,
            },
          });
        }
      }

      // Generate JaaS RS256 JWT Token (moderator: isHost)
      let jaasData = null;
      if (!conference.platform || conference.platform === "jitsi") {
        try {
          jaasData = JaasService.generateMeetingToken({
            roomName: conference.roomName,
            user: {
              id: String(registration?._id || dbUser?._id || `participant_${Date.now()}`),
              name: participantName,
              email: participantEmail,
            },
            moderator: isHost,
          });
        } catch (jaasErr: any) {
          console.error("[JaaS] Token generation error in getJoinInfo:", jaasErr);
          throw new AppError(`JaaS Token Error: ${jaasErr.message || jaasErr}`, 500);
        }
      }

      res.json({
        conference: {
          id: conference._id,
          title: conference.title,
          description: conference.description,
          roomName: jaasData ? jaasData.roomName : conference.roomName,
          rawRoomName: conference.roomName,
          enablePassword: conference.enablePassword,
          enableWaitingRoom: conference.enableWaitingRoom,
          enableRecording: conference.enableRecording,
          instructions: conference.instructions,
          duration: conference.duration,
          meetingDate: conference.meetingDate,
          meetingTime: conference.meetingTime,
          endTime: conference.endTime || "",
          platform: conference.platform || "jitsi",
          meetingLink: conference.meetingLink || "",
          isRedirectOnly: Boolean(conference.isRedirectOnly),
          endDateTime: endDateTime ? endDateTime.toISOString() : null,
          hostEmail: conference.hostEmail || "",
          isHost,
        },
        jaas: jaasData
          ? {
              token: jaasData.token,
              roomName: jaasData.roomName,
              domain: jaasData.domain,
              appId: jaasData.appId,
            }
          : null,
        user: {
          fullName: participantName,
          email: participantEmail,
          isHost,
        },
      });
    }
  );

  /**
   * POST /api/conferences/:id/track - Track attendance (join, heartbeat, leave)
   */
  static trackAttendance = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;
      const { event, deviceInfo, browserInfo, email } = req.body as {
        event: "join" | "heartbeat" | "leave";
        deviceInfo?: string;
        browserInfo?: string;
        email?: string;
      };

      const userId = req.user?.sub ? new mongoose.Types.ObjectId(req.user.sub) : null;
      let registration = userId
        ? await ConferenceRegistration.findOne({ conferenceId: id, userId })
        : null;
      if (!registration && email) {
        registration = await ConferenceRegistration.findOne({ conferenceId: id, email: email.toLowerCase().trim() });
      }

      if (!registration) {
        return res.json({ tracked: false, message: "Registration not found" });
      }

      const conference = await Conference.findById(id).lean();
      const now = new Date();

      if (event === "join") {
        registration.joined = true;
        if (!registration.joinedAt) registration.joinedAt = now;
        registration.joinTime = now;
        registration.leaveTime = undefined;
        registration.currentStatus = "joined";
        registration.rejoinCount = (registration.rejoinCount || 0) + 1;
        if (deviceInfo) registration.deviceInfo = deviceInfo;
        if (browserInfo) registration.browserInfo = browserInfo;
        if (req.ip) registration.ipAddress = req.ip;
      } else if (event === "heartbeat" || event === "leave") {
        if (registration.joinTime) {
          const sessionMinutes = (now.getTime() - new Date(registration.joinTime).getTime()) / (1000 * 60);
          registration.totalDuration = Math.round((registration.totalDuration || 0) + Math.max(sessionMinutes, 1));
          
          if (conference && conference.duration > 0) {
            registration.attendancePercentage = Math.min(
              100,
              Math.round((registration.totalDuration / conference.duration) * 100)
            );
          }
        }
        registration.leaveTime = now;
        if (event === "leave") {
          registration.currentStatus = "left";
        }
      }

      await registration.save();

      res.json({
        tracked: true,
        currentStatus: registration.currentStatus,
        totalDuration: registration.totalDuration,
        attendancePercentage: registration.attendancePercentage,
      });
    }
  );

  /**
   * GET /api/admin/conferences/:id/attendees - List attendees for Admin
   */
  static getAttendees = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;
      const { search, paymentStatus, attendanceStatus, sortBy } = req.query as Record<string, string>;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid conference ID", 400);
      }

      const conference = await Conference.findById(id).lean();
      if (!conference) throw new AppError("Conference not found", 404);

      const query: any = { conferenceId: id };

      if (paymentStatus === "confirmed") {
        query.paymentStatus = { $in: ["paid", "free"] };
      } else if (paymentStatus && paymentStatus !== "All") {
        query.paymentStatus = paymentStatus;
      }

      if (attendanceStatus && attendanceStatus !== "All") {
        query.currentStatus = attendanceStatus;
      }

      if (search) {
        query.$or = [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ];
      }

      let sortOption: any = { createdAt: -1 };
      if (sortBy === "joinTime") sortOption = { joinTime: -1 };
      if (sortBy === "amountPaid") sortOption = { paymentAmount: -1 };
      if (sortBy === "name") sortOption = { fullName: 1 };

      const registrations = await ConferenceRegistration.find(query)
        .populate("userId", "fullName role createdAt")
        .sort(sortOption)
        .lean();

      // Fetch payment IDs for paid registrations
      const enhanced = await Promise.all(
        registrations.map(async (reg) => {
          let paymentRecord = null;
          if (reg.paymentStatus === "paid") {
            paymentRecord = await ConferencePayment.findOne({
              registrationId: reg._id,
              status: "paid",
            }).lean();
          }

          return {
            ...reg,
            razorpayPaymentId: paymentRecord?.razorpayPaymentId || "",
            razorpayOrderId: paymentRecord?.razorpayOrderId || "",
          };
        })
      );

      res.json(enhanced);
    }
  );

  /**
   * GET /api/admin/conferences/:id/analytics - Live conference dashboard metrics
   */
  static getAnalytics = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid conference ID", 400);
      }

      const conference = await Conference.findById(id).lean();
      if (!conference) throw new AppError("Conference not found", 404);

      const allRegs = await ConferenceRegistration.find({ conferenceId: id }).lean();

      const totalRegistered = allRegs.length;
      const currentlyInMeeting = allRegs.filter((r) => r.currentStatus === "joined").length;
      const usersWaiting = allRegs.filter((r) => r.currentStatus === "waiting" || r.admitStatus === "waiting").length;
      const usersLeft = allRegs.filter((r) => r.currentStatus === "left").length;
      const noShow = allRegs.filter((r) => r.currentStatus === "no_show" || (!r.joined && r.currentStatus === "registered")).length;

      const totalRevenue = allRegs.reduce((acc, r) => acc + (r.paymentStatus === "paid" ? r.paymentAmount : 0), 0);

      const totalMinutesSpent = allRegs.reduce((acc, r) => acc + (r.totalDuration || 0), 0);
      const avgSessionDuration = totalRegistered > 0 ? Math.round(totalMinutesSpent / totalRegistered) : 0;

      res.json({
        totalRegistered,
        currentlyInMeeting,
        usersWaiting,
        usersLeft,
        noShow,
        totalRevenue,
        avgSessionDuration,
        conferenceTitle: conference.title,
        conferenceDuration: conference.duration,
        meetingDate: conference.meetingDate,
        meetingTime: conference.meetingTime,
        status: conference.status,
      });
    }
  );

  /**
   * PATCH /api/admin/conferences/:id/attendees/:registrationId - Admin update attendee
   */
  static updateAttendee = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { registrationId } = req.params;
      const { adminNotes, approvalStatus, paymentStatus, currentStatus } = req.body;

      const registration = await ConferenceRegistration.findById(registrationId);
      if (!registration) throw new AppError("Attendee registration not found", 404);

      if (adminNotes !== undefined) registration.adminNotes = adminNotes;
      if (approvalStatus) registration.approvalStatus = approvalStatus;
      if (paymentStatus) registration.paymentStatus = paymentStatus;
      if (currentStatus) registration.currentStatus = currentStatus;

      await registration.save();

      res.json({
        message: "Attendee updated successfully",
        registration,
      });
    }
  );

  /**
   * DELETE /api/admin/conferences/:id/attendees/:registrationId - Remove attendee
   */
  static removeAttendee = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { registrationId } = req.params;

      const registration = await ConferenceRegistration.findById(registrationId);
      if (!registration) throw new AppError("Attendee registration not found", 404);

      await ConferenceRegistration.deleteOne({ _id: registrationId });
      await ConferencePayment.deleteMany({ registrationId });

      res.json({ message: "Attendee removed from conference" });
    }
  );

  /**
   * GET /api/admin/conferences/:id/export - Export attendee data to CSV / Excel
   */
  static exportAttendees = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const id = req.params.id as string;
      const { format = "xlsx" } = req.query as { format?: string };

      const conference = await Conference.findById(id).lean();
      if (!conference) throw new AppError("Conference not found", 404);

      const registrations = await ConferenceRegistration.find({ conferenceId: id })
        .populate("userId", "role")
        .sort({ createdAt: -1 })
        .lean();

      const exportData = await Promise.all(
        registrations.map(async (r, idx) => {
          let payment = null;
          if (r.paymentStatus === "paid") {
            payment = await ConferencePayment.findOne({ registrationId: r._id, status: "paid" }).lean();
          }

          return {
            "S.No": idx + 1,
            "Full Name": r.fullName,
            "Age": r.age,
            "Email Address": r.email,
            "Phone Number": r.phone || "N/A",
            "Payment Status": r.paymentStatus.toUpperCase(),
            "Amount Paid (₹)": r.paymentAmount,
            "Razorpay Payment ID": payment?.razorpayPaymentId || "N/A",
            "Razorpay Order ID": payment?.razorpayOrderId || "N/A",
            "Current Status": r.currentStatus.toUpperCase(),
            "Approval Status": r.approvalStatus.toUpperCase(),
            "Registration Date": new Date(r.createdAt).toLocaleString(),
            "Join Time": r.joinTime ? new Date(r.joinTime).toLocaleString() : "N/A",
            "Leave Time": r.leaveTime ? new Date(r.leaveTime).toLocaleString() : "N/A",
            "Total Time Spent (Mins)": r.totalDuration || 0,
            "Attendance %": `${r.attendancePercentage || 0}%`,
            "Rejoin Count": r.rejoinCount || 0,
            "Device Info": r.deviceInfo || "N/A",
            "Browser Info": r.browserInfo || "N/A",
            "IP Address": r.ipAddress || "N/A",
            "Admin Notes": r.adminNotes || "",
          };
        })
      );

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Attendees");

      const sanitizeName = conference.title.replace(/[^a-zA-Z0-9]/g, "_");

      if (format === "csv") {
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${sanitizeName}_attendees.csv"`);
        return res.send(csv);
      } else {
        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", `attachment; filename="${sanitizeName}_attendees.xlsx"`);
        return res.send(buffer);
      }
    }
  );

  /** GET /conferences/:id/waiting-room — Fetch waiting attendees list */
  static getWaitingRoom = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const conference = await Conference.findById(id).lean();
    if (!conference) throw new AppError("Conference not found", 404);

    const filterQuery: any = {
      conferenceId: id,
      admitted: { $ne: true },
      $or: [{ currentStatus: "waiting" }, { admitStatus: "waiting" }],
    };

    const waiting = await ConferenceRegistration.find(filterQuery)
      .select("_id fullName email currentStatus admitStatus paymentStatus createdAt")
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      waiting: waiting.map((w: any) => ({
        id: w._id,
        fullName: w.fullName,
        email: w.email,
        paymentStatus: w.paymentStatus,
        createdAt: w.createdAt,
      })),
      count: waiting.length,
    });
  });

  static getWaitingRoomAttendees = ConferenceController.getWaitingRoom;

  /** POST /conferences/:id/waiting-room/admit — Admit an individual attendee */
  static admitAttendee = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { registrationId, email } = req.body as { registrationId?: string; email?: string };

    const conference = await Conference.findById(id).lean();
    if (!conference) throw new AppError("Conference not found", 404);

    let query: any = { conferenceId: id };
    if (registrationId) {
      query._id = registrationId;
    } else if (email) {
      query.email = email.toLowerCase().trim();
    } else {
      throw new AppError("registrationId or email is required", 400);
    }

    const reg = await ConferenceRegistration.findOneAndUpdate(
      query,
      { $set: { admitted: true, admitStatus: "admitted", currentStatus: "registered" } },
      { new: true }
    );

    if (!reg) throw new AppError("Attendee registration not found", 404);

    res.json({
      message: `Allowed ${reg.fullName} into the conference room`,
      registrationId: reg._id,
      email: reg.email,
    });
  });

  /** POST /conferences/:id/waiting-room/allow-waiting — Move attendee into waiting room lobby */
  static allowWaitingRoom = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { registrationId, email } = req.body as { registrationId?: string; email?: string };

    const conference = await Conference.findById(id).lean();
    if (!conference) throw new AppError("Conference not found", 404);

    let query: any = { conferenceId: id };
    if (registrationId) {
      query._id = registrationId;
    } else if (email) {
      query.email = email.toLowerCase().trim();
    } else {
      throw new AppError("registrationId or email is required", 400);
    }

    const reg = await ConferenceRegistration.findOneAndUpdate(
      query,
      { $set: { admitted: false, admitStatus: "waiting", currentStatus: "waiting" } },
      { new: true }
    );

    if (!reg) throw new AppError("Attendee registration not found", 404);

    res.json({
      message: `Allowed ${reg.fullName} into the Waiting Room lobby`,
      registrationId: reg._id,
      email: reg.email,
    });
  });

  /** POST /conferences/:id/waiting-room/admit-all — Admit waiting attendees at once */
  static admitAllAttendees = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { paymentStatus } = req.body as { paymentStatus?: string };

    const conference = await Conference.findById(id).lean();
    if (!conference) throw new AppError("Conference not found", 404);

    const filterQuery: any = {
      conferenceId: id,
      admitted: { $ne: true },
      $or: [{ currentStatus: "waiting" }, { admitStatus: "waiting" }],
    };

    if (paymentStatus === "confirmed") {
      filterQuery.paymentStatus = { $in: ["paid", "free"] };
    } else if (paymentStatus && paymentStatus !== "All") {
      filterQuery.paymentStatus = paymentStatus;
    }

    const result = await ConferenceRegistration.updateMany(
      filterQuery,
      { $set: { admitted: true, admitStatus: "admitted", currentStatus: "registered" } }
    );

    res.json({
      message: `Allowed all waiting attendees into the conference room`,
      admittedCount: result.modifiedCount,
    });
  });

  /** POST /conferences/:id/waiting-room/deny — Deny an individual attendee */
  static denyAttendee = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { registrationId, email } = req.body as { registrationId?: string; email?: string };

    let query: any = { conferenceId: id };
    if (registrationId) {
      query._id = registrationId;
    } else if (email) {
      query.email = email.toLowerCase().trim();
    } else {
      throw new AppError("registrationId or email is required", 400);
    }

    const reg = await ConferenceRegistration.findOneAndUpdate(
      query,
      { $set: { admitted: false, admitStatus: "denied", currentStatus: "no_show" } },
      { new: true }
    );

    if (!reg) throw new AppError("Attendee registration not found", 404);

    res.json({
      message: `Denied ${reg.fullName} entry to the conference room`,
      registrationId: reg._id,
      email: reg.email,
    });
  });

  /** POST /conferences/:id/check-email — Check if email is host or allowed by admin */
  static checkEmailStatus = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { email } = req.body;
    if (!email) throw new AppError("Email is required", 400);

    const cleanEmail = String(email).toLowerCase().trim();
    const conference = await Conference.findById(id).lean();
    if (!conference) throw new AppError("Conference not found", 404);

    const registration = await ConferenceRegistration.findOne({
      conferenceId: id,
      email: cleanEmail,
    }).lean();

    const isCreator = req.user?.sub && String(conference.createdBy) === String(req.user.sub);
    const hostEmailsList = conference.hostEmail
      ? conference.hostEmail.split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean)
      : [];
    const isDesignatedHost = Boolean(cleanEmail && hostEmailsList.includes(cleanEmail));
    const isAdmin = await isUserAdminOrDelegated(req);
    const isHost = Boolean(isAdmin || isCreator || isDesignatedHost);

    const isAdmittedToMeeting = Boolean(
      registration && (registration.admitted === true || registration.admitStatus === "admitted")
    );
    const isAllowedInWaitingRoom = Boolean(
      registration && (registration.currentStatus === "waiting" || registration.admitStatus === "waiting")
    );
    const isPaidOrFree = Boolean(registration && ["free", "paid"].includes(registration.paymentStatus));

    const isExemptFromPayment = isHost || isAdmittedToMeeting || isAllowedInWaitingRoom || isPaidOrFree;

    let statusMessage = "";
    if (isHost) statusMessage = "You are a Host for this conference (Free Entry)";
    else if (isAdmittedToMeeting) statusMessage = "Allowed by Admin! (Direct Meeting Access)";
    else if (isAllowedInWaitingRoom) statusMessage = "Allowed by Admin into Waiting Room (Free Entry)";
    else if (isPaidOrFree) statusMessage = "Registration Confirmed";

    res.json({
      email: cleanEmail,
      isHost,
      isAdmittedToMeeting,
      isAllowedInWaitingRoom,
      isPaidOrFree,
      isExemptFromPayment,
      statusMessage,
    });
  });
}
