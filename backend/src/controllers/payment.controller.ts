import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { TherapistBooking, User, AIReport } from "@/models";
import { AppError } from "@/lib/app-error";
import PaymentService from "@/services/payment.service";
import mongoose from "mongoose";
import { sendPaymentConfirmedToTherapist } from "@/services/email.service";
import { AIService } from "@/services/ai.service";

function getCallbackUrl(req: any, path: string): string {
  const baseUrl = (process.env.API_URL && process.env.API_URL !== "undefined" && process.env.API_URL.trim() !== "" && process.env.API_URL.startsWith("http"))
    ? process.env.API_URL.replace(/\/$/, "")
    : `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}${path}`;
}

function getClientOrigin(req: any): string {
  const envOrigin = process.env.CLIENT_ORIGIN;
  const isLocal = req.get("host")?.includes("localhost") || req.get("host")?.includes("127.0.0.1");

  if (isLocal) {
    return envOrigin || "http://localhost:5173";
  }

  if (envOrigin && envOrigin !== "undefined" && envOrigin.trim() !== "" && !envOrigin.includes("localhost")) {
    return envOrigin.replace(/\/$/, "");
  }

  const host = req.get("host") || "";
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  if (host.startsWith("api.")) {
    return `${protocol}://${host.substring(4)}`;
  }
  return `${protocol}://${host}`;
}

function sendCallbackResponse(
  res: Response,
  req: any,
  title: string,
  header: string,
  message: string,
  redirectPath: string,
  isSuccess: boolean
) {
  const clientOrigin = getClientOrigin(req);
  const redirectUrl = `${clientOrigin}${redirectPath}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="3;url=${redirectUrl}">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100vh; margin: 0; background-color: #F8FBFB;
      color: #2E6E65; padding: 20px; box-sizing: border-box; text-align: center;
    }
    .card {
      background: white; padding: 40px 30px; border-radius: 24px;
      box-shadow: 0 10px 30px rgba(46,110,101,0.05); max-width: 400px;
      width: 100%; border: 1px solid #E6EFEF;
      display: flex; flex-direction: column; align-items: center;
    }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h2 { margin: 0 0 12px; font-size: 24px; color: #1E4E47; font-weight: 700; }
    p { color: #608F87; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      background-color: #2E6E65; color: white; font-weight: 600; font-size: 14px;
      padding: 12px 24px; border-radius: 12px; text-decoration: none;
      transition: all 0.2s ease; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(46,110,101,0.15);
    }
    .btn:hover {
      background-color: #23544D;
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(46,110,101,0.2);
    }
    .btn:active {
      transform: translateY(0);
    }
    .redirect-text {
      font-size: 12px; color: #8AAEA9; margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? "✅" : "⏳"}</div>
    <h2>${header}</h2>
    <p>${message}</p>
    <a href="${redirectUrl}" class="btn">Return to App</a>
    <div class="redirect-text">Redirecting automatically in 3 seconds...</div>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = "${redirectUrl}";
    }, 3000);
  </script>
</body>
</html>
  `;
  res.send(html);
}

export class PaymentController {
  /**
   * Initiate a payment for a booking
   */
  static initiatePayment = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.body as { bookingId: string };

      if (!bookingId) {
        throw new AppError("bookingId is required", 400);
      }

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        userId: req.user!.sub,
      });

      if (!booking) {
        throw new AppError("Booking not found", 404);
      }

      if (booking.payment.paid) {
        throw new AppError("This booking is already paid", 400);
      }

      const user = await User.findById(req.user!.sub);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Validate user.phoneMasked: if it contains "@", it's an email; if it is a valid 10-digit number, it's contact info.
      const isEmail = user.phoneMasked?.includes("@");
      const userEmail = isEmail ? user.phoneMasked : undefined;
      const phoneRegex = /^\+?[1-9]\d{9,14}$/;
      const userPhone = (!isEmail && phoneRegex.test(user.phoneMasked)) ? user.phoneMasked : undefined;

      // Create Razorpay Payment Link (hosted page — works in mobile in-app browsers)
      const callbackUrl = getCallbackUrl(req, `/api/payment/${bookingId}/callback`);
      const link = await PaymentService.createPaymentLink({
        amount: booking.payment.amount,
        bookingId,
        userName: user.fullName,
        userContact: userPhone,
        userEmail: userEmail,
        callbackUrl,
      });

      // Store payment link id on the booking for later verification
      booking.payment.razorpayOrderId = link.paymentLinkId;
      await booking.save();

      res.json({
        paymentLinkId: link.paymentLinkId,
        shortUrl: link.shortUrl,
        amount: booking.payment.amount,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
        bookingId,
        userName: user.fullName,
      });
    },
  );


  /**
   * Verify payment and confirm booking
   */
  static verifyPayment = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId, orderId, paymentId, signature } = req.body as {
        bookingId: string;
        orderId: string;
        paymentId: string;
        signature: string;
      };

      if (!bookingId || !orderId || !paymentId || !signature) {
        throw new AppError("Missing required payment details", 400);
      }

      // Verify signature
      const isValid = PaymentService.verifyPaymentSignature(
        orderId,
        paymentId,
        signature,
      );
      if (!isValid) {
        throw new AppError("Invalid payment signature", 400);
      }

      // Verify payment with Razorpay
      const paymentDetails = await PaymentService.getPaymentDetails(paymentId);
      if (paymentDetails.status !== "captured") {
        throw new AppError("Payment not captured", 400);
      }

      // Update booking
      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        userId: req.user!.sub,
      });

      if (!booking) {
        throw new AppError("Booking not found", 404);
      }

      booking.payment.paid = true;
      booking.payment.razorpayPaymentId = paymentId;
      booking.status = "confirmed";
      await booking.save();

      // Send payment-confirmed email to therapist
      try {
        const therapist = await User.findById(booking.therapistId).select("therapistProfile").lean();
        const seeker = await User.findById(booking.userId).select("fullName").lean();
        const therapistEmail = therapist?.therapistProfile?.email;
        if (therapistEmail) {
          sendPaymentConfirmedToTherapist({
            therapistEmail,
            therapistName: therapist?.therapistProfile?.name || "Therapist",
            seekerName: seeker?.fullName || "Client",
            slot: booking.slot,
            fee: booking.payment.amount,
            bookingId: booking._id.toString(),
          }).catch(err => console.error("[Email] Payment confirmed email failed:", err));
        }
      } catch (err) {
        console.error("[Email] Could not send payment confirmed email:", err);
      }

      res.json({
        message: "Payment verified and booking confirmed",
        booking: {
          id: booking._id,
          status: booking.status,
          paid: booking.payment.paid,
          videoRoomId: booking.videoRoomId,
        },
      });
    },
  );

  /**
   * Demo: Bypass Razorpay for testing
   */
  static demoVerifyPayment = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.body as { bookingId: string };

      if (!bookingId) throw new AppError("Missing bookingId", 400);

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        userId: req.user!.sub,
      });

      if (!booking) throw new AppError("Booking not found", 404);

      booking.payment.paid = true;
      booking.status = "confirmed";
      await booking.save();

      // Send payment-confirmed email to therapist (demo mode)
      try {
        const therapist = await User.findById(booking.therapistId).select("therapistProfile").lean();
        const seeker = await User.findById(booking.userId).select("fullName").lean();
        const therapistEmail = therapist?.therapistProfile?.email;
        if (therapistEmail) {
          sendPaymentConfirmedToTherapist({
            therapistEmail,
            therapistName: therapist?.therapistProfile?.name || "Therapist",
            seekerName: seeker?.fullName || "Client",
            slot: booking.slot,
            fee: booking.payment.amount,
            bookingId: booking._id.toString(),
          }).catch(err => console.error("[Email] Demo payment confirmed email failed:", err));
        }
      } catch (err) {
        console.error("[Email] Could not send demo payment email:", err);
      }

      res.json({
        message: "Demo Payment verified",
        booking: {
          id: booking._id,
          status: booking.status,
          paid: booking.payment.paid,
          videoRoomId: booking.videoRoomId,
        },
      });
    },
  );

  /**
   * Handle Razorpay webhook
   */
  static handleWebhook = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const event = req.body;
      const signature = req.headers["x-razorpay-signature"];

      // Verify webhook signature if secret configured
      if (process.env.RAZORPAY_WEBHOOK_SECRET) {
        const body = JSON.stringify(event);
        const expectedSignature = require("crypto")
          .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
          .update(body)
          .digest("hex");

        if (expectedSignature !== signature) {
          throw new AppError("Invalid webhook signature", 400);
        }
      }

      const eventName = event.event;

      // Delegate subscription events to SubscriptionController
      if (
        eventName.startsWith("subscription.") ||
        event.payload?.subscription ||
        event.payload?.invoice?.entity?.subscription_id
      ) {
        const { SubscriptionController } = await import(
          "@/controllers/subscription.controller"
        );
        await SubscriptionController.processWebhookEvent(event);
        return res.json({ received: true });
      }

      const isSuccessEvent = [
        "payment.captured",
        "order.paid",
        "payment.authorized",
        "payment_link.paid",
      ].includes(eventName);

      if (isSuccessEvent) {
        const paymentEntity =
          event.payload?.payment?.entity || event.payload?.payment_link?.entity;
        const orderEntity = event.payload?.order?.entity;
        const paymentId = paymentEntity?.id;
        const orderId = paymentEntity?.order_id || orderEntity?.id;
        const notes = paymentEntity?.notes || orderEntity?.notes || {};
        const bookingId = notes.bookingId;

        if (bookingId && bookingId.startsWith("wallet_")) {
          const txId = bookingId.replace("wallet_", "");
          const { WalletTransaction } = await import(
            "@/models/wallet-transaction"
          );
          const tx = await WalletTransaction.findById(txId);
          if (tx && tx.status === "pending") {
            tx.status = "success";
            tx.razorpayPaymentId = paymentId;
            await tx.save();

            await User.findByIdAndUpdate(tx.userId, {
              $inc: { walletBalance: tx.amount },
            });
            console.log(
              `[Webhook] Wallet credit of ₹${tx.amount} successful for userId=${tx.userId}`
            );
          }
        } else if (bookingId && bookingId.startsWith("report_")) {
          const reportId = bookingId.replace("report_", "");
          const report = await AIReport.findById(reportId);
          if (report && !report.paid) {
            report.paid = true;
            report.razorpayPaymentId = paymentId;
            try {
              const analysis = await AIService.generateAIReportAnalysis(
                report.userId.toString(),
                report.startDate,
                report.endDate
              );
              report.aiAnalysis = analysis;
            } catch (err) {
              console.error(
                "AI report generation failed during webhook:",
                err
              );
              report.aiAnalysis =
                "Clinical Report by Dr. Manas:\n\nBased on your weekly activity logs, I notice that you are actively utilizing journaling to reframe negative thoughts, which is a great practice. I highly recommend booking a dedicated session with our professional therapist to delve deeper into these reframing patterns and work on long-term emotional resilience.";
            }
            await report.save();
          }
        } else if (bookingId && bookingId.startsWith("conf_")) {
          const registrationId = bookingId.replace("conf_", "");
          const { ConferenceRegistration, ConferencePayment } = await import(
            "@/models"
          );

          const registration = await ConferenceRegistration.findById(
            registrationId
          );
          if (registration) {
            registration.paymentStatus = "paid";
            await registration.save();
            console.log(
              `[Webhook] Conference registration ${registrationId} marked as paid`
            );
          }

          if (orderId || paymentId) {
            await ConferencePayment.findOneAndUpdate(
              { $or: [{ registrationId }, { razorpayOrderId: orderId }] },
              {
                razorpayPaymentId: paymentId || undefined,
                razorpayOrderId: orderId || undefined,
                status: "paid",
              }
            );
          }
        } else {
          // Check if orderId matches a ConferencePayment fallback
          if (orderId) {
            const { ConferenceRegistration, ConferencePayment } =
              await import("@/models");
            const confPayment = await ConferencePayment.findOne({
              razorpayOrderId: orderId,
            });
            if (confPayment) {
              confPayment.status = "paid";
              if (paymentId) confPayment.razorpayPaymentId = paymentId;
              await confPayment.save();

              await ConferenceRegistration.findByIdAndUpdate(
                confPayment.registrationId,
                {
                  paymentStatus: "paid",
                }
              );
              console.log(
                `[Webhook] Conference payment synced via orderId ${orderId}`
              );
              return res.json({ received: true });
            }
          }

          // Otherwise check TherapistBooking if bookingId is valid ObjectId
          if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
            const booking = await TherapistBooking.findById(bookingId);
            if (booking && !booking.payment.paid) {
              booking.payment.paid = true;
              booking.payment.razorpayPaymentId = paymentId;
              booking.status = "confirmed";
              await booking.save();

              // Send payment-confirmed email to therapist
              try {
                const therapist = await User.findById(booking.therapistId)
                  .select("therapistProfile")
                  .lean();
                const seeker = await User.findById(booking.userId)
                  .select("fullName")
                  .lean();
                const therapistEmail = therapist?.therapistProfile?.email;
                if (therapistEmail) {
                  sendPaymentConfirmedToTherapist({
                    therapistEmail,
                    therapistName:
                      therapist?.therapistProfile?.name || "Therapist",
                    seekerName: seeker?.fullName || "Client",
                    slot: booking.slot,
                    fee: booking.payment.amount,
                    bookingId: booking._id.toString(),
                  }).catch((err) =>
                    console.error(
                      "[Email] Webhook payment confirmed email failed:",
                      err
                    )
                  );
                }
              } catch (err) {
                console.error(
                  "[Email] Could not send webhook payment confirmed email:",
                  err
                );
              }
            }
          }
        }
      } else if (eventName === "payment.failed") {
        const paymentEntity = event.payload?.payment?.entity;
        const notes = paymentEntity?.notes || {};
        const bookingId = notes.bookingId;

        if (
          bookingId &&
          mongoose.Types.ObjectId.isValid(bookingId) &&
          !bookingId.startsWith("report_") &&
          !bookingId.startsWith("conf_")
        ) {
          const booking = await TherapistBooking.findById(bookingId);
          if (booking) {
            booking.status = "cancelled";
            await booking.save();
          }
        }
      }

      res.json({ received: true });
    },
  );

  /**
   * Get payment details for a booking
   */
  static getPaymentStatus = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        userId: req.user!.sub,
      });

      if (!booking) {
        throw new AppError("Booking not found", 404);
      }

      if (!booking.payment.paid && booking.payment.razorpayOrderId) {
        const { isPaid, paymentId } = await PaymentService.isOrderPaid(booking.payment.razorpayOrderId);
        if (isPaid) {
          booking.payment.paid = true;
          if (paymentId) booking.payment.razorpayPaymentId = paymentId;
          booking.status = "confirmed";
          await booking.save();
        }
      }

      res.json({
        bookingId,
        paid: booking.payment.paid,
        amount: booking.payment.amount,
        razorpayOrderId: booking.payment.razorpayOrderId,
        status: booking.status,
      });
    },
  );

  /**
   * Refund a booking payment
   */
  static refundBooking = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.params;

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        userId: req.user!.sub,
      });

      if (!booking) {
        throw new AppError("Booking not found", 404);
      }

      if (!booking.payment.paid) {
        throw new AppError("No payment to refund", 400);
      }

      if (booking.status === "completed") {
        throw new AppError("Cannot refund a completed session", 400);
      }

      // Find payment ID from Razorpay (in production, store this)
      // For now, we'll need to fetch from Razorpay using the order ID
      // In production, you should store the paymentId when verifying payment

      booking.status = "cancelled";
      booking.payment.paid = false;
      await booking.save();

      res.json({
        message: "Booking refunded successfully",
        bookingId,
      });
    },
  );

  /**
   * Handle Razorpay Payment Link callback after payment completes.
   * Razorpay redirects to this URL with query params after the user pays.
   */
  static handleCallback = asyncHandler(
    async (req: any, res: Response) => {
      const { bookingId } = req.params;
      const {
        razorpay_payment_id,
        razorpay_payment_link_id,
        razorpay_payment_link_status,
        razorpay_signature,
      } = req.query as Record<string, string>;

      const booking = await TherapistBooking.findById(bookingId);
      if (!booking) {
        return res.status(404).send("<h1>Booking not found</h1>");
      }

      // Mark as paid if Razorpay signals success
      if (razorpay_payment_link_status === "paid" && razorpay_payment_id) {
        if (!booking.payment.paid) {
          booking.payment.paid = true;
          booking.payment.razorpayPaymentId = razorpay_payment_id;
          booking.status = "confirmed";
          await booking.save();

          // Send confirmation email to therapist
          try {
            const therapist = await User.findById(booking.therapistId)
              .select("therapistProfile")
              .lean();
            const seeker = await User.findById(booking.userId)
              .select("fullName")
              .lean();
            const therapistEmail = therapist?.therapistProfile?.email;
            if (therapistEmail) {
              const { sendPaymentConfirmedToTherapist } = await import(
                "@/services/email.service"
              );
              sendPaymentConfirmedToTherapist({
                therapistEmail,
                therapistName:
                  therapist?.therapistProfile?.name || "Therapist",
                seekerName: seeker?.fullName || "Client",
                slot: booking.slot,
                fee: booking.payment.amount,
                bookingId: booking._id.toString(),
              }).catch((err: any) =>
                console.error("[Email] Callback payment email failed:", err),
              );
            }
          } catch (err) {
            console.error("[Email] Could not send callback payment email:", err);
          }
        }
      }

      const paid = booking.payment.paid;
      sendCallbackResponse(
        res,
        req,
        `MyMindTherapyFriend – Payment ${paid ? "Confirmed" : "Pending"}`,
        paid ? "Payment Confirmed!" : "Payment Pending",
        paid
          ? "Your therapy session has been booked successfully."
          : "Your payment is being processed. Once confirmed, please check your status in the app.",
        "/bookings",
        paid
      );
    },
  );

  static initiateReportPayment = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { startDate, endDate } = req.body as {
        startDate: string;
        endDate: string;
      };

      if (!startDate || !endDate) {
        throw new AppError("startDate and endDate are required", 400);
      }

      const user = await User.findById(req.user!.sub);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      let report;
      try {
        const safeUserId = mongoose.Types.ObjectId.isValid(req.user!.sub)
          ? new mongoose.Types.ObjectId(req.user!.sub)
          : req.user!.sub;

        report = await AIReport.create({
          userId: safeUserId,
          startDate: start,
          endDate: end,
          paid: false,
          amount: 29,
        });
      } catch (err: any) {
        console.error("AIReport creation failed:", err);
        throw new AppError(`AIReport creation failed: ${err.message}`, 500);
      }

      const isEmail = user.phoneMasked?.includes("@");
      const userEmail = isEmail ? user.phoneMasked : undefined;
      const phoneRegex = /^\+?[1-9]\d{9,14}$/;
      const userPhone = (!isEmail && phoneRegex.test(user.phoneMasked)) ? user.phoneMasked : undefined;

      const callbackUrl = getCallbackUrl(req, `/api/payment/report/${report._id}/callback`);
      
      let link;
      try {
        link = await PaymentService.createPaymentLink({
          amount: 29,
          bookingId: `report_${report._id}`,
          userName: user.fullName,
          userContact: userPhone,
          userEmail: userEmail,
          callbackUrl,
        });
      } catch (err: any) {
        console.error("PaymentService.createPaymentLink failed:", err);
        throw new AppError(`PaymentService.createPaymentLink failed: ${err.message}`, 500);
      }

      try {
        report.razorpayPaymentLinkId = link.paymentLinkId;
        await report.save();
      } catch (err: any) {
        console.error("Saving AIReport after payment link failed:", err);
        throw new AppError(`Saving AIReport after payment link failed: ${err.message}`, 500);
      }

      res.json({
        paymentLinkId: link.paymentLinkId,
        shortUrl: link.shortUrl,
        amount: 29,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
        reportId: report._id,
        userName: user.fullName,
      });
    }
  );

  /**
   * Demo verify premium AI report analysis (bypass Razorpay)
   */
  static demoVerifyReportPayment = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { reportId } = req.body as { reportId: string };

      if (!reportId) throw new AppError("Missing reportId", 400);

      const report = await AIReport.findOne({
        _id: reportId,
        userId: req.user!.sub,
      });

      if (!report) throw new AppError("Report not found", 404);

      report.paid = true;

      try {
        const analysis = await AIService.generateAIReportAnalysis(
          req.user!.sub,
          report.startDate,
          report.endDate
        );
        report.aiAnalysis = analysis;
      } catch (err) {
        console.error("AI report generation failed during demo verify:", err);
        report.aiAnalysis = "Clinical Report by Dr. Manas:\n\nBased on your weekly activity logs, I notice that you are actively utilizing journaling to reframe negative thoughts, which is a great practice. I highly recommend booking a dedicated session with our professional therapist to delve deeper into these reframing patterns and work on long-term emotional resilience.";
      }

      await report.save();

      res.json({
        message: "Demo Payment verified for AI Report",
        report: {
          id: report._id,
          paid: report.paid,
          aiAnalysis: report.aiAnalysis,
        },
      });
    }
  );

  /**
   * Razorpay callback redirect for report payment link status checking
   */
  static handleReportCallback = asyncHandler(
    async (req: any, res: Response) => {
      const { reportId } = req.params;
      const {
        razorpay_payment_id,
        razorpay_payment_link_id,
        razorpay_payment_link_status,
      } = req.query as Record<string, string>;

      const report = await AIReport.findById(reportId);
      if (!report) {
        return res.status(404).send("<h1>Report not found</h1>");
      }

      if (razorpay_payment_link_status === "paid" && razorpay_payment_id) {
        if (!report.paid) {
          report.paid = true;
          report.razorpayPaymentId = razorpay_payment_id;

          try {
            const analysis = await AIService.generateAIReportAnalysis(
              report.userId.toString(),
              report.startDate,
              report.endDate
            );
            report.aiAnalysis = analysis;
          } catch (err) {
            console.error("AI report generation failed during report callback:", err);
            report.aiAnalysis = "Clinical Report by Dr. Manas:\n\nBased on your weekly activity logs, I notice that you are actively utilizing journaling to reframe negative thoughts, which is a great practice. I highly recommend booking a dedicated session with our professional therapist to delve deeper into these reframing patterns and work on long-term emotional resilience.";
          }

          await report.save();
        }
      }

      const paid = report.paid;
      sendCallbackResponse(
        res,
        req,
        `MyMindTherapyFriend – Report Payment ${paid ? "Confirmed" : "Pending"}`,
        paid ? "Payment Confirmed!" : "Payment Pending",
        paid
          ? "Your premium AI Therapist analysis has been unlocked successfully."
          : "Your payment is being processed. Once confirmed, your report will be generated.",
        "/reports",
        paid
      );
    }
  );

  /**
   * GET /api/payment/wallet/balance — Get wallet balance and transactions
   */
  static getMyWalletBalance = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const user = await User.findById(req.user!.sub);
      if (!user) throw new AppError("User not found", 404);

      const { WalletTransaction } = await import("@/models/wallet-transaction");

      // Auto-check any pending transactions for this user
      const pendingTxs = await WalletTransaction.find({
        userId: req.user!.sub,
        status: "pending",
        razorpayPaymentLinkId: { $exists: true, $ne: "" },
      });

      if (pendingTxs.length > 0) {
        try {
          const Razorpay = (await import("razorpay")).default;
          const key_id = process.env.RAZORPAY_KEY_ID;
          const key_secret = process.env.RAZORPAY_KEY_SECRET;
          if (key_id && key_secret) {
            const rzp = new Razorpay({ key_id, key_secret });
            for (const tx of pendingTxs) {
              if (tx.razorpayPaymentLinkId) {
                const linkObj: any = await rzp.paymentLink.fetch(tx.razorpayPaymentLinkId);
                if (linkObj && linkObj.status === "paid") {
                  tx.status = "success";
                  await tx.save();
                  await User.findByIdAndUpdate(tx.userId, {
                    $inc: { walletBalance: tx.amount },
                  });
                  user.walletBalance = (user.walletBalance || 0) + tx.amount;
                }
              }
            }
          }
        } catch (txErr) {
          console.warn("[Wallet Balance Sync] Error checking pending wallet links:", txErr);
        }
      }

      const transactions = await WalletTransaction.find({ userId: req.user!.sub })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      res.json({
        walletBalance: user.walletBalance || 0,
        transactions,
      });
    }
  );

  /**
   * POST /api/payment/wallet/add — Initiate adding funds to wallet via Razorpay
   */
  static addFundsWallet = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { amount } = req.body as { amount: number };

      if (!amount || isNaN(amount) || amount <= 0) {
        throw new AppError("Please provide a valid amount", 400);
      }

      const user = await User.findById(req.user!.sub);
      if (!user) throw new AppError("User not found", 404);

      const { WalletTransaction } = await import("@/models/wallet-transaction");
      
      // Create a pending wallet transaction
      const tx = await WalletTransaction.create({
        userId: user._id,
        amount,
        type: "credit",
        purpose: "add_funds",
        status: "pending",
      });

      const isEmail = user.phoneMasked?.includes("@");
      const userEmail = isEmail ? user.phoneMasked : undefined;
      const phoneRegex = /^\+?[1-9]\d{9,14}$/;
      const userPhone = (!isEmail && phoneRegex.test(user.phoneMasked)) ? user.phoneMasked : undefined;

      const callbackUrl = getCallbackUrl(req, `/api/payment/wallet/callback/${tx._id}`);

      // Create Razorpay payment link for adding funds
      let link;
      try {
        link = await PaymentService.createPaymentLink({
          amount,
          bookingId: `wallet_${tx._id}`,
          userName: user.fullName,
          userContact: userPhone,
          userEmail: userEmail,
          callbackUrl,
        });
      } catch (err: any) {
        console.error("PaymentService.createPaymentLink failed:", err);
        tx.status = "failed";
        await tx.save();
        throw new AppError(`Failed to initiate payment link: ${err.message}`, 500);
      }

      tx.razorpayPaymentLinkId = link.paymentLinkId;
      await tx.save();

      res.json({
        paymentLinkId: link.paymentLinkId,
        shortUrl: link.shortUrl,
        amount,
        currency: "INR",
        txId: tx._id,
      });
    }
  );

  /**
   * POST /api/payment/wallet/pay-booking — Pay for therapist booking using wallet balance
   */
  static payBookingWallet = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { bookingId } = req.body as { bookingId: string };

      if (!bookingId) {
        throw new AppError("bookingId is required", 400);
      }

      const booking = await TherapistBooking.findOne({
        _id: bookingId,
        userId: req.user!.sub,
      });

      if (!booking) {
        throw new AppError("Booking not found", 404);
      }

      if (booking.payment.paid) {
        throw new AppError("Booking is already paid", 400);
      }

      const user = await User.findById(req.user!.sub);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const amountToDeduct = booking.payment.amount;

      if ((user.walletBalance || 0) < amountToDeduct) {
        throw new AppError(`Insufficient wallet balance. You need ₹${amountToDeduct} but have ₹${user.walletBalance || 0}.`, 400);
      }

      // Deduct funds
      user.walletBalance = (user.walletBalance || 0) - amountToDeduct;
      await user.save();

      // Create a successful debit transaction
      const { WalletTransaction } = await import("@/models/wallet-transaction");
      await WalletTransaction.create({
        userId: user._id,
        amount: amountToDeduct,
        type: "debit",
        purpose: "book_therapist",
        status: "success",
        referenceId: booking._id,
      });

      // Update booking status
      booking.payment.paid = true;
      booking.status = "confirmed";
      await booking.save();

      // Send email notifications
      try {
        const therapist = await User.findById(booking.therapistId).select("therapistProfile").lean();
        const therapistEmail = therapist?.therapistProfile?.email;
        if (therapistEmail) {
          sendPaymentConfirmedToTherapist({
            therapistEmail,
            therapistName: therapist?.therapistProfile?.name || "Therapist",
            seekerName: user.fullName || "Client",
            slot: booking.slot,
            fee: amountToDeduct,
            bookingId: booking._id.toString(),
          }).catch(err => console.error("[Email] Wallet booking confirmation email failed:", err));
        }
      } catch (err) {
        console.error("[Email] Could not send wallet booking confirmation email:", err);
      }

      res.json({
        message: "Booking paid successfully using wallet",
        booking: {
          id: booking._id,
          status: booking.status,
          paid: booking.payment.paid,
        }
      });
    }
  );

  /**
   * POST /api/payment/report/initiate-wallet — Pay for AI report using wallet balance
   */
  static initiateReportPaymentWallet = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { startDate, endDate } = req.body as {
        startDate: string;
        endDate: string;
      };

      if (!startDate || !endDate) {
        throw new AppError("startDate and endDate are required", 400);
      }

      const user = await User.findById(req.user!.sub);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      if ((user.walletBalance || 0) < 29) {
        throw new AppError("Insufficient wallet balance. Please add money to your wallet.", 400);
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Deduct from wallet
      user.walletBalance = (user.walletBalance || 0) - 29;
      await user.save();

      // Create a successful debit transaction
      const { WalletTransaction } = await import("@/models/wallet-transaction");
      const tx = await WalletTransaction.create({
        userId: user._id,
        amount: 29,
        type: "debit",
        purpose: "unlock_report",
        status: "success",
      });

      // Create paid AIReport document
      const report = await AIReport.create({
        userId: user._id,
        startDate: start,
        endDate: end,
        paid: true,
        amount: 29,
      });

      // Link reference ID
      tx.referenceId = report._id;
      await tx.save();

      // Generate analysis
      try {
        const analysis = await AIService.generateAIReportAnalysis(
          user._id.toString(),
          start,
          end
        );
        report.aiAnalysis = analysis;
      } catch (err) {
        console.error("AI report generation failed:", err);
        report.aiAnalysis = "Clinical Report by Dr. Manas:\n\nBased on your weekly activity logs, I notice that you are actively utilizing journaling to reframe negative thoughts, which is a great practice. I highly recommend booking a dedicated session with our professional therapist to delve deeper into these reframing patterns and work on long-term emotional resilience.";
      }
      await report.save();

      res.json({
        message: "Report unlocked successfully using wallet",
        report: {
          id: report._id,
          paid: report.paid,
          aiAnalysis: report.aiAnalysis,
        }
      });
    }
  );

  /**
   * GET /api/payment/wallet/callback/:txId — Razorpay callback redirect for wallet addition
   */
  static handleWalletCallback = asyncHandler(
    async (req: any, res: Response) => {
      const { txId } = req.params;
      const {
        razorpay_payment_id,
        razorpay_payment_link_status,
      } = req.query as Record<string, string>;

      const { WalletTransaction } = await import("@/models/wallet-transaction");
      const tx = await WalletTransaction.findById(txId);
      if (!tx) {
        return res.status(404).send("<h1>Transaction not found</h1>");
      }

      if (razorpay_payment_link_status === "paid" && razorpay_payment_id) {
        if (tx.status === "pending") {
          tx.status = "success";
          tx.razorpayPaymentId = razorpay_payment_id;
          await tx.save();

          await User.findByIdAndUpdate(tx.userId, {
            $inc: { walletBalance: tx.amount }
          });
        }
      }

      const success = tx.status === "success" || razorpay_payment_link_status === "paid";
      sendCallbackResponse(
        res,
        req,
        `MyMindTherapyFriend – Wallet Deposit ${success ? "Success" : "Pending"}`,
        success ? "Funds Added Successfully!" : "Deposit Pending",
        success
          ? `₹${tx.amount.toFixed(2)} has been added to your wallet balance.`
          : "Your deposit is being processed. Once confirmed, your balance will be updated automatically.",
        "/wallet",
        success
      );
    }
  );
}

