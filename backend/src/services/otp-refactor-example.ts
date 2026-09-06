/**
 * REFACTORED OTP INTEGRATION EXAMPLE
 * 
 * This demonstrates the improved code structure with:
 * - Dedicated OTP service with clean separation of concerns
 * - Proper error handling and response types
 * - Type-safe implementations
 * - Better logging and debugging
 */

import { OTPService } from "@/services/otp.service";
import { AuthService } from "@/services/auth.service";
import type { Request, Response } from "express";
import { asyncHandler } from "@/lib/async-handler";

// ============================================================================
// EXAMPLE 1: Using OTPService Directly (Standalone)
// ============================================================================

export const sendOTPExample = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body;

  try {
    // Send OTP with improved error handling
    const result = await OTPService.sendOTP(phone);

    res.json({
      success: true,
      message: result.message,
      requestId: result.requestId,
      expiresInSeconds: 300,
    });
  } catch (error) {
    // Error handling is done by asyncHandler middleware
    throw error;
  }
});

export const verifyOTPExample = asyncHandler(async (req: Request, res: Response) => {
  const { phone, otp } = req.body;

  try {
    // Verify OTP with improved error handling
    const result = await OTPService.verifyOTP(phone, otp);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    throw error;
  }
});

// ============================================================================
// EXAMPLE 2: Using Through AuthService (Recommended for Auth Flow)
// ============================================================================

export const authSendOTPExample = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body;

  // AuthService handles phone normalization and user creation
  const result = await AuthService.sendOTP(phone);

  res.json({
    message: "OTP sent successfully",
    phone: result.phone,
    expiresInSeconds: result.expiresInSeconds,
  });
});

export const authVerifyOTPExample = asyncHandler(async (req: Request, res: Response) => {
  const { phone, otp } = req.body;

  // AuthService verifies OTP and creates/updates user
  const user = await AuthService.verifyOTP(phone, otp);
  const token = AuthService.generateToken(user);

  res.cookie("mymindtherapyfriend_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  res.json({
    user: {
      id: user._id,
      role: user.role,
      tier: user.tier,
    },
  });
});

// ============================================================================
// KEY IMPROVEMENTS
// ============================================================================

/**
 * ✅ SEPARATION OF CONCERNS
 * - OTPService: Handles only OTP generation, sending, and verification
 * - AuthService: Handles user authentication and profile management
 * 
 * ✅ IMPROVED ERROR HANDLING
 * - Specific error types and status codes
 * - Detailed error logging with masked sensitive data
 * - Timeout handling for API requests
 * - Graceful fallback for non-JSON responses
 * 
 * ✅ TYPE SAFETY
 * - Proper TypeScript interfaces for request/response
 * - Clear return types for all methods
 * - Better IDE autocomplete and type checking
 * 
 * ✅ BETTER LOGGING
 * - Structured logging with prefixes ([OTP Service])
 * - Request/response tracking
 * - Security: masked API keys in logs
 * 
 * ✅ RATE LIMITING
 * - Built-in 60-second cooldown per phone
 * - Prevents MSG91 API spam and 502 errors
 * 
 * ✅ DEVELOPMENT MODE SUPPORT
 * - In-memory OTP storage for testing
 * - Clear console logging of OTP in dev mode
 * - No SMS sent when MSG91 not configured
 * 
 * ✅ REUSABILITY
 * - OTPService can be used for password reset, verification, etc.
 * - Not tightly coupled to authentication
 * - Easy to test independently
 */

// ============================================================================
// TESTING HELPERS
// ============================================================================

/**
 * Clear pending OTPs (useful in test environments)
 */
export function clearTestOTPs(): void {
  OTPService.clearPendingOTPs();
}

/**
 * Clear rate limit for a phone (useful in test environments)
 */
export function clearTestRateLimit(phone: string): void {
  OTPService.clearRateLimit(phone);
}
