import { env } from "@/config/env";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import { errorHandler } from "@/middleware/error-handler";
import { apiRouter } from "@/routes";

export async function createApp() {
  await mongoose.connect(env.MONGODB_URI);

  // Auto-configure revenue & subscription metrics on existing DB records for production readiness
  try {
    const { seedRevenueOnExistingOnly } = await import("@/scripts/seed-existing-only");
    seedRevenueOnExistingOnly().catch((e) => console.error("[StartupSeed] Revenue setup warning:", e));
  } catch (err) {
    console.error("[StartupSeed] Error loading revenue setup:", err);
  }

  const app = express();
  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));
  app.use(cookieParser());
  app.use(morgan("dev"));

  // Serve uploaded images statically with explicit Cross-Origin headers
  const { getUploadDirectory } = await import("@/middleware/upload.middleware");
  app.use(
    ["/uploads/images", "/api/uploads/images"],
    (req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Access-Control-Allow-Origin", "*");
      next();
    },
    express.static(getUploadDirectory())
  );

  app.use("/api", apiRouter);
  app.use(errorHandler);

  return app;
}
