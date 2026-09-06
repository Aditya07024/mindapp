import { Router } from "express";
import authRoutes from "./auth";
import chatRoutes from "./chat";
import moodRoutes from "./mood";
import journalRoutes from "./journal";
import therapistRoutes from "./therapist";
import userRoutes from "./user";
import bookingRoutes from "./booking";
import adminRoutes from "./admin";
import paymentRoutes from "./payment";
import subscriptionRoutes from "./subscription";
import orgRoutes from "./org";
import planRoutes from "./plan";
import notificationRoutes from "./notification";
import conferenceRoutes from "./conference";
import videoRoutes from "./video";
import accountRoutes from "./account";
import popupAnnouncementRoutes from "./popup-announcement";
import meetingPhotoRoutes from "./meeting-photo";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ ok: true }));

apiRouter.use("/auth", authRoutes);
apiRouter.use("/account", accountRoutes);
apiRouter.use("/chat", chatRoutes);
apiRouter.use("/user", userRoutes);
apiRouter.use("/mood", moodRoutes);
apiRouter.use("/moods", moodRoutes);
apiRouter.use("/journal", journalRoutes);
apiRouter.use("/therapist", therapistRoutes);   // keep /therapist for any old callers
apiRouter.use("/therapists", therapistRoutes);  // canonical plural
apiRouter.use("/bookings", bookingRoutes);
apiRouter.use("/payment", paymentRoutes);
apiRouter.use("/subscription", subscriptionRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/org", orgRoutes);
apiRouter.use("/plans", planRoutes);
apiRouter.use("/notifications", notificationRoutes);
apiRouter.use("/conferences", conferenceRoutes);
apiRouter.use("/video", videoRoutes);
apiRouter.use("/popup-announcement", popupAnnouncementRoutes);
apiRouter.use("/meeting-photos", meetingPhotoRoutes);



