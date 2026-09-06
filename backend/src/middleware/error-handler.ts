import type { NextFunction, Request, Response } from "express";
import { AppError } from "@/lib/app-error";

export function errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("[Error Handler]", error);
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  return res.status(500).json({ message: error.message || "Internal server error" });
}
