/**
 * OTP Service Testing Examples
 * 
 * Demonstrates how to test the refactored OTPService
 * with proper setup/teardown and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { OTPService } from "@/services/otp.service";
import { AppError } from "@/lib/app-error";

describe("OTPService", () => {
  beforeEach(() => {
    // Clear test state before each test
    OTPService.clearPendingOTPs();
    OTPService.clearRateLimit("919876543210");
  });

  afterEach(() => {
    // Cleanup after each test
    OTPService.clearPendingOTPs();
  });

  // ============================================================================
  // OTP GENERATION TESTS
  // ============================================================================

  describe("generateOTP", () => {
    it("should generate a 6-digit OTP", () => {
      const otp = OTPService.generateOTP();
      expect(otp).toMatch(/^\d{6}$/);
    });

    it("should generate different OTPs on each call", () => {
      const otp1 = OTPService.generateOTP();
      const otp2 = OTPService.generateOTP();
      expect(otp1).not.toBe(otp2);
    });

    it("should always be in valid range", () => {
      for (let i = 0; i < 100; i++) {
        const otp = parseInt(OTPService.generateOTP());
        expect(otp).toBeGreaterThanOrEqual(100000);
        expect(otp).toBeLessThanOrEqual(999999);
      }
    });
  });

  // ============================================================================
  // SEND OTP TESTS
  // ============================================================================

  describe("sendOTP", () => {
    it("should send OTP successfully in dev mode", async () => {
      // In dev mode (no MSG91_AUTH_KEY), OTP is generated and stored
      const result = await OTPService.sendOTP("919876543210");

      expect(result.success).toBe(true);
      expect(result.message).toContain("successfully");
    });

    it("should rate limit OTP requests", async () => {
      // First request should succeed
      const result1 = await OTPService.sendOTP("919876543210");
      expect(result1.success).toBe(true);

      // Second request within cooldown should fail
      try {
        await OTPService.sendOTP("919876543210");
        fail("Should have thrown rate limit error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(429);
        expect((error as AppError).message).toContain("wait");
      }
    });

    it("should not rate limit different phone numbers", async () => {
      const result1 = await OTPService.sendOTP("919876543210");
      const result2 = await OTPService.sendOTP("918765432101");

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it("should allow retry after rate limit expires", async () => {
      // This would require mocking time or using jest.useFakeTimers()
      const result1 = await OTPService.sendOTP("919876543210");
      expect(result1.success).toBe(true);

      // Clear rate limit (simulating time passing)
      OTPService.clearRateLimit("919876543210");

      const result2 = await OTPService.sendOTP("919876543210");
      expect(result2.success).toBe(true);
    });
  });

  // ============================================================================
  // VERIFY OTP TESTS
  // ============================================================================

  describe("verifyOTP", () => {
    it("should verify correct OTP", async () => {
      // First, send an OTP
      await OTPService.sendOTP("919876543210");

      // Get the OTP from console (in real tests, you'd capture it or inject it)
      const testOTP = "123456"; // In dev mode, we'd need to capture this

      // Verify would work with correct OTP (in production with MSG91)
      // This is primarily tested with MSG91 integration tests
    });

    it("should reject invalid OTP", async () => {
      await OTPService.sendOTP("919876543210");

      try {
        await OTPService.verifyOTP("919876543210", "000000");
        fail("Should have thrown invalid OTP error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(400);
        expect((error as AppError).message).toContain("Invalid");
      }
    });

    it("should reject expired OTP", async () => {
      // Set up fake timers if needed
      // For now, this is more of an integration test with MSG91
    });
  });

  // ============================================================================
  // INTEGRATION TESTS WITH AUTHSERVICE
  // ============================================================================

  describe("Integration with AuthService", () => {
    it("should work with AuthService.sendOTP", async () => {
      // Import here to avoid circular dependencies
      const { AuthService } = await import("@/services/auth.service");

      const result = await AuthService.sendOTP("9876543210");

      expect(result.phone).toBe("9876543210");
      expect(result.expiresInSeconds).toBe(300);
    });

    it("should work with AuthService.verifyOTP", async () => {
      // This would be an integration test that:
      // 1. Sends OTP via AuthService
      // 2. Captures OTP from storage
      // 3. Verifies OTP and checks user creation
      // Requires database setup
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      // This would require mocking the HTTPS module
      // and simulating network failures
    });

    it("should handle timeout errors", async () => {
      // This would require mocking HTTPS with setTimeout
      // to simulate a timeout scenario
    });

    it("should handle non-JSON responses", async () => {
      // This would require mocking HTTPS to return invalid JSON
      // (e.g., Cloudflare error page)
    });

    it("should handle MSG91 error responses", async () => {
      // This would require mocking MSG91 API
      // to return error type responses
    });
  });

  // ============================================================================
  // UTILITY FUNCTION TESTS
  // ============================================================================

  describe("Utility Functions", () => {
    it("should clear pending OTPs", async () => {
      await OTPService.sendOTP("919876543210");
      OTPService.clearPendingOTPs();

      try {
        await OTPService.verifyOTP("919876543210", "123456");
        fail("Should have thrown error - no pending OTP");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }
    });

    it("should clear rate limit", async () => {
      await OTPService.sendOTP("919876543210");

      // This should fail due to rate limit
      try {
        await OTPService.sendOTP("919876543210");
        fail("Should have thrown rate limit error");
      } catch {
        // Expected
      }

      // Clear rate limit
      OTPService.clearRateLimit("919876543210");

      // This should now succeed
      const result = await OTPService.sendOTP("919876543210");
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// MOCK SETUP FOR MSG91 INTEGRATION TESTS
// ============================================================================

/**
 * Example mock setup for testing with MSG91
 * 
 * In package.json, add:
 * "jest": {
 *   "setupFilesAfterEnv": ["<rootDir>/test/setup.ts"]
 * }
 */

export const setupOTPTestMocks = () => {
  // Mock HTTPS module
  jest.mock("https", () => ({
    get: jest.fn((url, options, callback) => {
      // Simulate MSG91 success response
      if (url.includes("send")) {
        setTimeout(() => {
          callback({
            statusCode: 200,
            on: jest.fn((event, handler) => {
              if (event === "data") {
                handler(JSON.stringify({ type: "success", request_id: "123" }));
              } else if (event === "end") {
                handler();
              }
            }),
          });
        }, 0);
      }

      return {
        on: jest.fn(),
        destroy: jest.fn(),
      };
    }),
  }));
};

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe("OTPService Performance", () => {
  it("should generate OTP quickly", () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      OTPService.generateOTP();
    }
    const duration = performance.now() - start;

    // Should generate 1000 OTPs in less than 10ms
    expect(duration).toBeLessThan(10);
  });

  it("should handle concurrent requests", async () => {
    const phones = Array.from({ length: 10 }, (_, i) => `919876543${i}`);

    // Send OTPs concurrently
    const promises = phones.map((phone) => OTPService.sendOTP(phone));
    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    expect(results.every((r) => r.success)).toBe(true);
  });
});
