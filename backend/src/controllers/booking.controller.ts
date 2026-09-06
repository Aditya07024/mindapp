import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { User, TherapistBooking, Mood, JournalEntry } from "@/models";
import { AppError } from "@/lib/app-error";
import LiveKitService from "@/services/livekit.service";
import mongoose from "mongoose";
import { NotificationController } from "./notification.controller";
import { sendBookingNotificationToTherapist, sendBookingConfirmationToSeeker } from "@/services/email.service";


export class BookingController {
  static getMyBookings = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const bookings = await TherapistBooking.find({ userId: req.user!.sub })
        .sort({ slot: 1 })
        .lean();

      // Enrich with therapist name
      const enriched = await Promise.all(
        bookings.map(async (b) => {
          const therapist = await User.findById(b.therapistId)
            .select("therapistProfile phoneMasked")
            .lean();
          return {
            id: b._id,
            therapistId: b.therapistId,
            therapistName: therapist?.therapistProfile?.name ?? "Therapist",
            therapistSpecialization:
              therapist?.therapistProfile?.specializations?.[0] ?? "",
            slot: b.slot,
            status: b.status,
            amount: b.payment.amount,
            paid: b.payment.paid,
            videoRoomId: b.videoRoomId,
            journalShareState: b.journalShareState || "none",
            prescription: b.prescription || null,
          };
        }),
      );

      res.json({ bookings: enriched });
    },
  );

  static createBooking = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { therapistId, slot } = req.body as {
        therapistId: string;
        slot: string;
      };

      if (!therapistId || !slot) {
        throw new AppError("therapistId and slot are required", 400);
      }

      const therapist = await User.findById(therapistId);
      if (
        !therapist ||
        therapist.role !== "therapist" ||
        !therapist.therapistProfile
      ) {
        throw new AppError("Therapist not found", 404);
      }

      const slotDate = new Date(slot);
      if (isNaN(slotDate.getTime()))
        throw new AppError("Invalid slot date", 400);
      if (slotDate < new Date())
        throw new AppError("Cannot book a past slot", 400);

      // Clean up old pending_payment bookings (older than 30 minutes)
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      await TherapistBooking.updateMany(
        { status: "pending_payment", createdAt: { $lt: thirtyMinsAgo } },
        { status: "cancelled" }
      );

      // Check slot is not already booked (exclude pending_payment bookings)
      const conflict = await TherapistBooking.findOne({
        therapistId,
        slot: slotDate,
        status: { $in: ["confirmed", "completed", "pending"] },
      });
      if (conflict) throw new AppError("This slot is already booked", 409);

      // Calculate amount based on user subscription or organization benefits
      let amount = therapist.therapistProfile.sessionFee ?? 0;

      const seekerUser = await User.findById(req.user!.sub).select("orgId phoneMasked fullName");
      let isOrgCovered = false;

      const seekerEmail = (seekerUser?.phoneMasked?.includes("@") ? seekerUser.phoneMasked : "").toLowerCase().trim();

      const { Organization } = await import("@/models/organization");
      
      let userOrg = seekerUser?.orgId ? await Organization.findById(seekerUser.orgId) : null;
      if (!userOrg && seekerEmail) {
        userOrg = await Organization.findOne({ allowedEmails: seekerEmail, verificationStatus: "verified" });
        if (userOrg && seekerUser) {
          seekerUser.orgId = userOrg._id as any;
          await seekerUser.save();
        }
      }

      if (userOrg && (userOrg.coverMemberTherapyFees || userOrg.verificationStatus === "verified")) {
        isOrgCovered = true;
        amount = 0;
      }

      if (!isOrgCovered) {
        const { Subscription } = await import("@/models/subscription");
        const activeSub = await Subscription.findOne({
          userId: req.user!.sub,
          status: "active",
        }).sort({ createdAt: -1 });

        if (activeSub) {
          // Find non-cancelled bookings since subscription start date
          const bookingCount = await TherapistBooking.countDocuments({
            userId: req.user!.sub,
            status: { $in: ["confirmed", "completed", "pending_payment"] },
            createdAt: { $gte: activeSub.startDate },
          });

          const planLower = (activeSub.plan || "").toLowerCase();

          if (planLower.includes("apna") || planLower === "apna_therapist") {
            // "After 3 Bookings, 1 booking is free": 4th booking in a cycle of 4 is free
            if ((bookingCount + 1) % 4 === 0) {
              amount = 0;
            }
          } else if (planLower.includes("shanti") || planLower === "mann_shanti") {
            // "After 5 bookings, 2 bookings are free": 6th & 7th bookings in a cycle of 7 are free
            const position = bookingCount % 7;
            if (position >= 5) {
              amount = 0;
            } else {
              // 10% therapist discount for paid bookings in this tier
              amount = Math.round(amount * 0.9);
            }
          }
        }
      }

      const isFree = amount === 0;

      const safeUserId = mongoose.Types.ObjectId.isValid(req.user!.sub)
        ? new mongoose.Types.ObjectId(req.user!.sub)
        : req.user!.sub;
      const safeTherapistId = mongoose.Types.ObjectId.isValid(therapistId)
        ? new mongoose.Types.ObjectId(therapistId)
        : therapistId;

      const booking = await TherapistBooking.create({
        userId: safeUserId,
        therapistId: safeTherapistId,
        slot: slotDate,
        status: isFree ? "confirmed" : "pending_payment",
        payment: {
          amount,
          paid: isFree,
        },
        videoRoomId: `room-${Date.now()}`,
      });

      // Send live notifications
      try {
        const seekerUser = await User.findById(req.user!.sub).select("fullName");
        const seekerName = seekerUser?.fullName || "A Seeker";
        const formattedSlot = slotDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

        // Seeker confirmation notification
        await NotificationController.createNotification(
          req.user!.sub,
          isFree ? "Booking Confirmed" : "Booking Reserved",
          isFree 
            ? `Your appointment with Dr. ${therapist.therapistProfile.name} is confirmed for ${formattedSlot}.`
            : `Your appointment with Dr. ${therapist.therapistProfile.name} is reserved for ${formattedSlot}.`,
          "booking",
          { bookingId: booking._id.toString(), therapistId }
        );

        // Therapist notification alert
        await NotificationController.createNotification(
          therapistId,
          isFree ? "New Session Booked & Confirmed" : "New Session Booked",
          isFree 
            ? `${seekerName} has booked and paid (Free Benefit) a session with you for ${formattedSlot}.`
            : `${seekerName} has booked a counseling session with you for ${formattedSlot}.`,
          "booking",
          { bookingId: booking._id.toString(), seekerId: req.user!.sub }
        );

        // Send EMAIL to therapist only if booking is free (confirmed immediately).
        // For paid bookings, email will be sent after payment is confirmed.
        const therapistEmail = therapist.therapistProfile.email;
        if (therapistEmail && isFree) {
          const { sendPaymentConfirmedToTherapist } = await import("@/services/email.service");
          sendPaymentConfirmedToTherapist({
            therapistEmail,
            therapistName: therapist.therapistProfile.name || "Therapist",
            seekerName,
            slot: slotDate,
            fee: 0,
            bookingId: booking._id.toString(),
          }).catch(err => console.error("[Email] Free therapist booking email failed:", err));
        }

      } catch (err) {
        console.error("[Notifications] Failed sending booking alerts:", err);
      }

      res.status(201).json({
        booking: {
          id: booking._id,
          therapistId,
          therapistName: therapist.therapistProfile.name,
          slot: booking.slot,
          status: booking.status,
          amount: booking.payment.amount,
          videoRoomId: booking.videoRoomId,
        },
      });
    },
  );

  static cancelBooking = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        userId: req.user!.sub,
      });

      if (!booking) throw new AppError("Booking not found", 404);
      if (booking.status === "cancelled")
        throw new AppError("Already cancelled", 400);
      if (booking.status === "completed")
        throw new AppError("Cannot cancel a completed session", 400);

      booking.status = "cancelled";
      await booking.save();

      // Send live cancellation notifications
      try {
        const seekerName = (await User.findById(req.user!.sub).select("fullName"))?.fullName || "A Seeker";
        const formattedSlot = new Date(booking.slot).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

        // Notify Therapist of cancellation
        await NotificationController.createNotification(
          booking.therapistId.toString(),
          "Session Cancelled",
          `${seekerName} has cancelled the session booked for ${formattedSlot}.`,
          "booking",
          { bookingId: booking._id.toString(), seekerId: req.user!.sub }
        );
      } catch (err) {
        console.error("[Notifications] Failed sending cancellation alert:", err);
      }

      res.json({ message: "Booking cancelled successfully", bookingId });
    },
  );

  /** GET /bookings/:bookingId/video-token — Get LiveKit token for video session */
  static getVideoToken = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;

      if (bookingId === "demo-room") {
        const user = await User.findById(req.user!.sub).select("fullName");
        if (!user) throw new AppError("User not found", 404);

        const token = await LiveKitService.generateToken({
          roomName: "demo-room",
          userName: user.fullName || "Demo User",
          userId: `demo-${req.user!.sub}-${Math.random().toString(36).substring(7)}`,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          duration: 7200, // 2 hours
        });

        return res.json({
          token,
          url: LiveKitService.getLiveKitURL(),
          roomName: "demo-room",
        });
      }

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        $or: [{ userId: req.user!.sub }, { therapistId: req.user!.sub }],
      });

      if (!booking)
        throw new AppError("Booking not found or not authorized", 404);
      if (booking.status !== "confirmed") {
        throw new AppError(
          "Booking must be confirmed to start video session",
          400,
        );
      }

      const user = await User.findById(req.user!.sub).select("fullName");
      if (!user) throw new AppError("User not found", 404);

      if (!LiveKitService.isConfigured()) {
        throw new AppError("Video service not configured", 500);
      }

      // Check if session is within 15 minutes and not more than 2 hours after slot time
      const now = new Date().getTime();
      const slotTime = booking.slot.getTime();
      const timeDiff = now - slotTime;
      const fifteenMinutesMs = 15 * 60 * 1000;
      const twoHoursMs = 2 * 60 * 60 * 1000;

      if (timeDiff < -fifteenMinutesMs) {
        throw new AppError("Session starts in more than 15 minutes", 400);
      }

      if (timeDiff > twoHoursMs) {
        throw new AppError("Session time has expired", 400);
      }

      try {
        const token = await LiveKitService.generateToken({
          roomName: booking.videoRoomId!,
          userName: user.fullName || "User",
          userId: req.user!.sub,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          duration: 7200, // 2 hours
        });

        res.json({
          token,
          url: LiveKitService.getLiveKitURL(),
          roomName: booking.videoRoomId,
        });
      } catch (error) {
        throw new AppError("Failed to generate video token", 500);
      }
    },
  );

  /** GET /bookings/:bookingId — Get single booking details */
  static getSingleBooking = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;

      if (bookingId === "demo-room") {
        return res.json({
          id: "demo-room",
          therapistId: "demo-therapist",
          therapistName: "Demo User",
          slot: new Date().toISOString(),
          status: "confirmed",
          amount: 0,
          paid: true,
          videoRoomId: "demo-room",
        });
      }

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        $or: [{ userId: req.user!.sub }, { therapistId: req.user!.sub }],
      }).lean();

      if (!booking) throw new AppError("Booking not found", 404);

      const therapist = await User.findById(booking.therapistId)
        .select("therapistProfile phoneMasked")
        .lean();

      res.json({
        id: booking._id,
        therapistId: booking.therapistId,
        therapistName: therapist?.therapistProfile?.name ?? "Therapist",
        slot: booking.slot,
        status: booking.status,
        amount: booking.payment.amount,
        paid: booking.payment.paid,
        videoRoomId: booking.videoRoomId,
        journalShareState: booking.journalShareState || "none",
        prescription: booking.prescription || null,
      });
    },
  );

  /** POST /bookings/:bookingId/rate — Post-session rating */
  static rateSession = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;
      const { rating, feedback } = req.body as { rating: number; feedback?: string };

      if (!rating || rating < 1 || rating > 5) {
        throw new AppError("Rating must be between 1 and 5", 400);
      }

      if (bookingId === "demo-room") {
        return res.json({ message: "Demo rating submitted successfully" });
      }

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        userId: req.user!.sub,
      });

      if (!booking) throw new AppError("Booking not found", 404);

      booking.status = "completed";
      booking.rating = rating;
      if (feedback) booking.review = feedback;
      await booking.save();
      
      // Update therapist's average rating
      const allRated = await TherapistBooking.find({
        therapistId: booking.therapistId,
        status: "completed",
        rating: { $exists: true },
      }).lean();

      if (allRated.length > 0) {
        const ratings = allRated
          .map((b) => b.rating)
          .filter((r): r is number => r !== undefined && r !== null);
 
        if (ratings.length > 0) {
          const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          await User.findByIdAndUpdate(booking.therapistId, {
            "therapistProfile.rating": Math.round(avgRating * 10) / 10,
            "therapistProfile.sessionCount": allRated.length,
          });
        }
      }

      res.json({ message: "Rating submitted successfully" });
    },
  );



  /** GET /bookings/:bookingId/ai-brief — Groq-powered AI brief for therapist before session */
  static getAiBrief = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;

      if (bookingId === "demo-room") {
        return res.json({
          clientId: "demo-client",
          moodChart: [],
          avgMood: 7,
          riskLevel: "low",
          recentJournals: [],
          groqSummary: "This is a demo AI brief. The client has shown stable mood patterns recently. No immediate risk factors identified.",
          sessionCount: 0,
        });
      }

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        $or: [{ userId: req.user!.sub }, { therapistId: req.user!.sub }],
      }).lean();

      if (!booking) throw new AppError("Booking not found", 404);

      const user = await User.findById(req.user!.sub).select("role").lean();
      if (!user) throw new AppError("User not found", 404);

      // Fetch client's last 7 days of moods
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const moods = await Mood.find({
        userId: booking.userId,
        date: { $gte: sevenDaysAgo },
      })
        .sort({ date: 1 })
        .select("score date tags note")
        .lean();

      // Fetch last 5 journal entries
      const journals = await JournalEntry.find({ userId: booking.userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("content createdAt")
        .lean();

      // Compute analytics
      const avgMood =
        moods.length > 0
          ? Math.round((moods.reduce((s, m) => s + m.score, 0) / moods.length) * 10) / 10
          : null;

      const riskLevel =
        avgMood === null ? "unknown"
        : avgMood < 4 ? "high"
        : avgMood < 6 ? "medium"
        : "low";

      // Build Groq prompt
      const moodSummary = moods
        .map((m) => `${new Date(m.date).toDateString()}: score ${m.score}/10${m.note ? ` — "${m.note}"` : ""}`)
        .join("\n");

      const journalSummary = journals
        .map((j, i) => `Entry ${i + 1} (${new Date(j.createdAt).toDateString()}): ${
          typeof j.content === "string" ? j.content.slice(0, 300) : ""
        }`)
        .join("\n\n");

      let groqSummary: string | null = null;

      const apiKey = process.env.HF_TOKEN;
      if (apiKey && (moods.length > 0 || journals.length > 0)) {
        try {
          const prompt = `You are a clinical psychologist assistant. Summarise the following client data for their therapist in 3-4 concise bullet points. Focus on: mood trend, key emotional themes, risk indicators, and suggested areas to explore in today's session. Be clinical but compassionate. Do not use the client's name.

MOOD DATA (last 7 days, scale 1-10):
${moodSummary || "No mood data available."}

RECENT JOURNAL ENTRIES:
${journalSummary || "No journal entries available."}

Average mood: ${avgMood ?? "N/A"}/10
Risk level: ${riskLevel}

Write a therapist pre-session brief:`;

          const model = process.env.HF_MODEL || "meta-llama/Llama-3.3-70B-Instruct";
          const url = `https://router.huggingface.co/v1/chat/completions`;

          const resp = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              temperature: 0.3,
              max_tokens: 400,
              messages: [{ role: "user", content: prompt }],
            }),
          });

          if (resp.ok) {
            const data = (await resp.json()) as {
              choices?: Array<{ message?: { content?: string } }>;
            };
            groqSummary = data.choices?.[0]?.message?.content?.trim() ?? null;
          }
        } catch (err) {
          console.error("[AI Brief] AI pre-session brief call failed:", err);
        }
      }

      const client = await User.findById(booking.userId)
        .select("fullName onboarding")
        .lean();

      res.json({
        clientId: booking.userId,
        clientName: client?.fullName || "Anonymous Client",
        onboardingDetails: client?.onboarding || null,
        moodChart: moods.map((m) => ({
          date: m.date,
          score: m.score,
          tags: (m as any).tags ?? [],
        })),
        avgMood,
        riskLevel,
        recentJournals: journals.map((j) => ({
          date: j.createdAt,
          excerpt: typeof j.content === "string" ? j.content.slice(0, 200) : "",
        })),
        groqSummary,
        sessionCount: 0,
      });
    },
  );

  /** PATCH /bookings/:bookingId/notes — Therapist saves session notes */
  static saveNotes = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;
      const { notes } = req.body as { notes: string };

      if (bookingId === "demo-room") {
        return res.json({ message: "Demo notes saved" });
      }

      const booking = await TherapistBooking.findOneAndUpdate(
        { _id: bookingId, therapistId: req.user!.sub },
        { therapistNotes: notes },
        { new: true },
      );

      if (!booking) throw new AppError("Booking not found or not your session", 404);
      res.json({ message: "Notes saved" });
    },
  );

  /** POST /bookings/:bookingId/request-journal — Therapist requests journal access */
  static requestJournalReport = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;
      const therapistId = req.user!.sub;

      console.log(`[Journal Request] bookingId: ${bookingId}, therapistId: ${therapistId}`);

      const booking = await TherapistBooking.findOne({
        _id: new mongoose.Types.ObjectId(bookingId as string),
        therapistId: new mongoose.Types.ObjectId(therapistId),
      });

      if (!booking) {
        console.error(`[Journal Request Error] Booking not found or not authorized. bookingId: ${bookingId}, therapistId: ${therapistId}`);
        throw new AppError("Booking not found or not authorized", 404);
      }
      if (booking.status !== "confirmed") {
        throw new AppError("Access can only be requested for confirmed bookings", 400);
      }

      booking.journalShareState = "requested";
      await booking.save();

      // Send a notification alert to the user seeker
      try {
        const therapistName = (await User.findById(therapistId).select("therapistProfile"))?.therapistProfile?.name || "Your therapist";
        const formattedSlot = new Date(booking.slot).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

        await NotificationController.createNotification(
          booking.userId.toString(),
          "Journal Access Requested",
          `Dr. ${therapistName} requested access to view your CBT journal entries from last week to prepare for your session on ${formattedSlot}.`,
          "booking",
          { bookingId: booking._id.toString(), therapistId }
        );
      } catch (err) {
        console.error("[Notifications] Failed sending journal request alert:", err);
      }

      res.json({ message: "Journal access requested successfully", journalShareState: "requested" });
    }
  );

  /** POST /bookings/:bookingId/respond-journal — User responds to journal request */
  static respondToJournalRequest = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;
      const { approve } = req.body as { approve: boolean };
      const userId = req.user!.sub;

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        userId,
      });

      if (!booking) throw new AppError("Booking not found or not authorized", 404);
      if (booking.journalShareState !== "requested") {
        throw new AppError("No pending journal access request found for this booking", 400);
      }

      booking.journalShareState = approve ? "approved" : "declined";
      await booking.save();

      // Send a notification alert to the therapist
      try {
        const seekerName = (await User.findById(userId).select("fullName"))?.fullName || "A Seeker";
        const title = approve ? "Journal Access Approved" : "Journal Access Declined";
        const msg = approve 
          ? `${seekerName} approved your request to view their CBT journal logs from last week.`
          : `${seekerName} declined your request to view their CBT journal logs.`;

        await NotificationController.createNotification(
          booking.therapistId.toString(),
          title,
          msg,
          "booking",
          { bookingId: booking._id.toString(), seekerId: userId }
        );
      } catch (err) {
        console.error("[Notifications] Failed sending journal response alert:", err);
      }

      res.json({ message: `Response registered: ${booking.journalShareState}`, journalShareState: booking.journalShareState });
    }
  );

  /** GET /bookings/:bookingId/shared-journals — Therapist views user's 7-day journal entries */
  static getSharedJournals = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;
      const therapistId = req.user!.sub;

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        therapistId,
      }).lean();

      if (!booking) throw new AppError("Booking not found or not authorized", 404);
      if (booking.journalShareState !== "approved") {
        throw new AppError("Journal access has not been approved for this session", 403);
      }

      const sessionDate = new Date(booking.slot);
      const sevenDaysPrior = new Date(sessionDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const journals = await JournalEntry.find({
        userId: booking.userId,
        createdAt: { $gte: sevenDaysPrior, $lte: sessionDate }
      })
        .sort({ createdAt: -1 })
        .lean();

      res.json({ journals });
    }
  );

  /** PATCH /bookings/:bookingId/prescription — Therapist saves prescription */
  static savePrescription = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;
      const { medicines, notes } = req.body as { medicines: string[]; notes: string };

      if (bookingId === "demo-room") {
        return res.json({ message: "Demo prescription saved" });
      }

      if (!Array.isArray(medicines)) {
        throw new AppError("Medicines must be an array of strings", 400);
      }

      const booking = await TherapistBooking.findOneAndUpdate(
        { _id: bookingId, therapistId: req.user!.sub },
        {
          prescription: {
            medicines,
            notes: notes || "",
            writtenAt: new Date(),
          },
        },
        { new: true }
      );

      if (!booking) {
        throw new AppError("Booking not found or not your session", 404);
      }

      res.json({ message: "Prescription saved successfully", prescription: booking.prescription });
    }
  );
}
