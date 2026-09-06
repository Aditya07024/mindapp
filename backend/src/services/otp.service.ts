import https from "https";
import { env } from "@/config/env";
import { AppError } from "@/lib/app-error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MSG91Response {
  type: string;
  message?: string;
  request_id?: string;
  [key: string]: unknown;
}

interface OTPResult {
  success: boolean;
  message: string;
  requestId?: string;
}

interface OTPVerifyResult {
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MSG91_SEND_URL = "https://control.msg91.com/api/v5/otp";
const MSG91_VERIFY_URL = "https://control.msg91.com/api/v5/otp/verify";
const REQUEST_TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------------
// In-memory OTP store — used ONLY when MSG91 is not configured (dev/test)
// ---------------------------------------------------------------------------
type PendingOtpRecord = {
  code: string;
  expiresAt: number;
};

const pendingOtps = new Map<string, PendingOtpRecord>();

// ---------------------------------------------------------------------------
// Rate limiter — 60s cooldown per phone to prevent MSG91 spam
// ---------------------------------------------------------------------------
const otpRateLimit = new Map<string, number>();
const OTP_COOLDOWN_MS = 60_000;

export class OTPService {
  /**
   * Generate a random 6-digit OTP
   */
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Make HTTPS request to MSG91 API with proper error handling
   */
  private static async makeRequest(
    url: string,
    params: Record<string, string>,
  ): Promise<MSG91Response> {
    // Build query string
    const qs = new URLSearchParams(params).toString();
    const fullUrl = `${url}?${qs}`;

    // Log safe version (mask authkey)
    const logParams = {
      ...params,
      authkey: params.authkey ? "***" + params.authkey.slice(-4) : "(none)",
    };
    console.log(`[OTP Service] Making request to: ${url}`);
    console.log(`[OTP Service] Params:`, logParams);

    return new Promise((resolve, reject) => {
      const request = https.get(fullUrl, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
        let data = "";

        res.on("data", (chunk: string) => {
          data += chunk;
        });

        res.on("end", () => {
          console.log(`[OTP Service] Response Status: ${res.statusCode}`);

          // Handle non-2xx responses
          if (res.statusCode && res.statusCode >= 400) {
            console.error(
              `[OTP Service] HTTP Error ${res.statusCode}: ${data.slice(0, 200)}`,
            );
          }

          try {
            const parsed = JSON.parse(data) as MSG91Response;
            console.log(`[OTP Service] Parsed response:`, {
              type: parsed.type,
              message: parsed.message,
            });
            resolve(parsed);
          } catch (parseError) {
            // MSG91 occasionally returns non-JSON (e.g., Cloudflare errors)
            console.error(
              `[OTP Service] Failed to parse response (HTTP ${res.statusCode}): ${data.slice(0, 100)}`,
            );
            resolve({
              type: "error",
              message: `HTTP ${res.statusCode}: Invalid response format`,
            });
          }
        });
      });

      request.on("timeout", () => {
        request.destroy();
        console.error(`[OTP Service] Request timeout after ${REQUEST_TIMEOUT_MS}ms`);
        reject(new AppError("OTP service timeout. Please try again.", 504));
      });

      request.on("error", (err) => {
        console.error(`[OTP Service] Network error:`, err.message);
        reject(new AppError("Failed to connect to OTP service.", 502));
      });
    });
  }

  /**
   * Send OTP to phone number via MSG91
   */
  static async sendOTP(mobile: string): Promise<OTPResult> {
    console.log(`\n[OTP Service] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[OTP Service] Sending OTP to: ${mobile}`);

    // Check rate limit
    const now = Date.now();
    const lastSent = otpRateLimit.get(mobile);
    if (lastSent && now - lastSent < OTP_COOLDOWN_MS) {
      const waitSecs = Math.ceil((OTP_COOLDOWN_MS - (now - lastSent)) / 1000);
      console.warn(`[OTP Service] Rate limited: Must wait ${waitSecs}s`);
      throw new AppError(
        `Please wait ${waitSecs} seconds before requesting another OTP.`,
        429,
      );
    }

    otpRateLimit.set(mobile, now);

    // No MSG91 config - use dev fallback
    if (!env.MSG91_AUTH_KEY) {
      if (env.NODE_ENV === "production") {
        console.error(`[OTP Service] MSG91_AUTH_KEY missing in production`);
        throw new AppError("SMS service is not configured.", 500);
      }

      const otp = this.generateOTP();
      pendingOtps.set(mobile, {
        code: otp,
        expiresAt: now + 5 * 60 * 1000,
      });

      console.warn(`[OTP Service] ⚠️  DEV MODE - OTP: ${otp}`);
      console.log(`[OTP Service] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      return {
        success: true,
        message: "OTP sent successfully (dev mode)",
      };
    }

    // Send via MSG91
    const params: Record<string, string> = {
      authkey: env.MSG91_AUTH_KEY,
      mobile,
      otp_length: "6",
      otp_expiry: "5", // 5 minutes
    };

    if (env.MSG91_TEMPLATE_ID) {
      params.template_id = env.MSG91_TEMPLATE_ID;
    }

    try {
      const response = await this.makeRequest(MSG91_SEND_URL, params);

      // Check for error in response
      if (response.type === "error") {
        console.error(`[OTP Service] MSG91 failed:`, response.message);
        throw new AppError("Failed to send OTP. Please try again.", 502);
      }

      console.log(`[OTP Service] ✅ OTP sent successfully`);
      console.log(`[OTP Service] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      return {
        success: true,
        message: "OTP sent successfully",
        requestId: response.request_id as string | undefined,
      };
    } catch (error) {
      console.error(`[OTP Service] Exception during send:`, error);
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to send OTP. Please try again.", 502);
    }
  }

  /**
   * Verify OTP sent to phone number
   */
  static async verifyOTP(mobile: string, otp: string): Promise<OTPVerifyResult> {
    console.log(`\n[OTP Service] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[OTP Service] Verifying OTP for: ${mobile}`);

    // Dev fallback - check in-memory store
    if (!env.MSG91_AUTH_KEY) {
      if (env.NODE_ENV === "production") {
        throw new AppError("SMS service is not configured.", 500);
      }

      const pending = pendingOtps.get(mobile);
      const now = Date.now();
      const isValid = pending &&
        pending.expiresAt > now &&
        pending.code === otp;

      if (!isValid) {
        console.warn(`[OTP Service] Invalid or expired OTP`);
        console.log(`[OTP Service] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        throw new AppError("Invalid or expired OTP", 400);
      }

      pendingOtps.delete(mobile);
      console.log(`[OTP Service] ✅ OTP verified (dev mode)`);
      console.log(`[OTP Service] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      return {
        success: true,
        message: "OTP verified successfully",
      };
    }

    // Verify via MSG91
    try {
      const response = await this.makeRequest(MSG91_VERIFY_URL, {
        authkey: env.MSG91_AUTH_KEY,
        mobile,
        otp,
      });

      if (response.type === "error") {
        console.warn(`[OTP Service] Verification failed:`, response.message);
        console.log(`[OTP Service] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        throw new AppError("Invalid or expired OTP", 400);
      }

      console.log(`[OTP Service] ✅ OTP verified successfully`);
      console.log(`[OTP Service] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      return {
        success: true,
        message: "OTP verified successfully",
      };
    } catch (error) {
      console.error(`[OTP Service] Exception during verify:`, error);
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to verify OTP. Please try again.", 502);
    }
  }

  /**
   * Clear all pending OTPs (useful for testing)
   */
  static clearPendingOTPs(): void {
    pendingOtps.clear();
  }

  /**
   * Clear rate limit for a phone number (useful for testing)
   */
  static clearRateLimit(mobile: string): void {
    otpRateLimit.delete(mobile);
  }
}
