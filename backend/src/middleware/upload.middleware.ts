import multer from "multer";
import path from "path";
import fs from "fs";
import { AppError } from "@/lib/app-error";

// Target VPS upload directory as required
const VPS_UPLOAD_DIR = "/var/www/MindGod-uploads/images";
// Fallback local directory for local dev environments
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "uploads", "images");

export function getUploadDirectory(): string {
  try {
    if (fs.existsSync("/var/www/MindGod-uploads")) {
      if (!fs.existsSync(VPS_UPLOAD_DIR)) {
        fs.mkdirSync(VPS_UPLOAD_DIR, { recursive: true });
      }
      return VPS_UPLOAD_DIR;
    }
  } catch (e) {
    // fallback to local directory
  }

  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
  return LOCAL_UPLOAD_DIR;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const targetDir = getUploadDirectory();
    cb(null, targetDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".webp";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext) ? ext : ".webp";
    const uniqueFilename = `conference-poster-${Date.now()}-${Math.random().toString(36).substring(2, 9)}${safeExt}`;
    cb(null, uniqueFilename);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError("Invalid file type. Only JPG, PNG, WEBP, GIF, and AVIF images are allowed.", 400));
  }
};

export const posterUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

export function getPublicUrlForFilename(filename: string, req?: any): string {
  if (!filename) return "";

  const cleanFilename = path.basename(filename);

  if (req) {
    const protocol = req.headers?.["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers?.["x-forwarded-host"] || (req.get && req.get("host"));
    if (host) {
      return `${protocol}://${host}/uploads/images/${cleanFilename}`;
    }
  }

  const envUrl = process.env.API_URL || process.env.VITE_API_URL || process.env.BACKEND_URL;
  if (envUrl) {
    return `${envUrl.replace(/\/$/, "")}/uploads/images/${cleanFilename}`;
  }

  const port = process.env.PORT || "8080";
  return `http://localhost:${port}/uploads/images/${cleanFilename}`;
}


export function deleteFileFromStorage(posterUrlOrPath?: string | null) {
  if (!posterUrlOrPath) return;

  try {
    const filename = path.basename(posterUrlOrPath);
    const targetDir = getUploadDirectory();
    const filePath = path.join(targetDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Error deleting file from storage:", err);
  }
}
