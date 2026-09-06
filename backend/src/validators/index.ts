import { z } from "zod";

export const otpRequestSchema = z.object({
  body: z.object({
    phone: z.string().min(10)
  })
});

export const otpVerifySchema = z.object({
  body: z.object({
    phone: z.string().min(10),
    otp: z.string().min(4)
  })
});

export const moodSchema = z.object({
  body: z.object({
    score: z.number().min(1).max(5),
    label: z.string(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional()
  })
});

export const journalSchema = z.object({
  body: z.object({
    prompt: z.string(),
    situation: z.string().optional(),
    thought: z.string().optional(),
    evidenceFor: z.string().optional(),
    balancedResponse: z.string().optional()
  })
});

export const chatSchema = z.object({
  body: z.object({
    message: z.string().min(1)
  })
});
