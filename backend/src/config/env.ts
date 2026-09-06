import { config } from "dotenv";
import { z } from "zod";

// Load environment variables from .env
config();

// Determine environment mode: support both process.env.node and process.env.NODE_ENV
// "deployment" -> development (localhost mode)
// "production" -> production mode
const rawNode = (process.env.node || process.env.NODE || process.env.NODE_ENV || "development").toLowerCase();
const isProd = rawNode === "production";
const resolvedEnvMode = isProd ? "production" : "development";

// Force override process.env.NODE_ENV so other packages (e.g. Express, mongoose) align correctly
process.env.NODE_ENV = resolvedEnvMode;

function getEnvVar(key: string, devFallback?: string): string | undefined {
  const devKey = `${key}_DEV`;
  const prodKey = `${key}_PROD`;

  if (isProd) {
    return process.env[prodKey] ?? process.env[key];
  } else {
    return process.env[devKey] ?? process.env[key] ?? devFallback;
  }
}

// Dynamically construct environment object
const resolvedEnv = {
  NODE_ENV: resolvedEnvMode,
  PORT: getEnvVar("PORT", "8080"),
  MONGODB_URI: getEnvVar("MONGODB_URI"),
  CLERK_SECRET_KEY: getEnvVar("CLERK_SECRET_KEY"),
  CLERK_PUBLISHABLE_KEY: getEnvVar("CLERK_PUBLISHABLE_KEY"),
  CLIENT_ORIGIN: getEnvVar("CLIENT_ORIGIN", !isProd ? "http://localhost:5173" : undefined),
  API_URL: getEnvVar("API_URL"),
  JWT_SECRET: getEnvVar("JWT_SECRET"),
  GEMINI_API_KEY: getEnvVar("GEMINI_API_KEY"),
  HF_TOKEN: getEnvVar("HF_TOKEN"),
  HF_MODEL: getEnvVar("HF_MODEL", "meta-llama/Llama-3.3-70B-Instruct"),
  RAZORPAY_KEY_ID: getEnvVar("RAZORPAY_KEY_ID"),
  RAZORPAY_KEY_SECRET: getEnvVar("RAZORPAY_KEY_SECRET"),
  RAZORPAY_WEBHOOK_SECRET: getEnvVar("RAZORPAY_WEBHOOK_SECRET"),
  RAZORPAY_PLAN_MANN_SHANTI: getEnvVar("RAZORPAY_PLAN_MANN_SHANTI"),
  RAZORPAY_PLAN_APNA_THERAPIST: getEnvVar("RAZORPAY_PLAN_APNA_THERAPIST"),
  MSG91_AUTH_KEY: getEnvVar("MSG91_AUTH_KEY"),
  MSG91_TEMPLATE_ID: getEnvVar("MSG91_TEMPLATE_ID"),
  LIVEKIT_API_KEY: getEnvVar("LIVEKIT_API_KEY"),
  LIVEKIT_API_SECRET: getEnvVar("LIVEKIT_API_SECRET"),
  LIVEKIT_URL: getEnvVar("LIVEKIT_URL"),
};

// Set resolved values back on process.env so that external modules/libraries
// reading process.env directly get the correctly resolved environment values.
Object.entries(resolvedEnv).forEach(([key, val]) => {
  if (val !== undefined) {
    process.env[key] = val;
  }
});

const envSchema = z.object({
  PORT: z.string().default("8080"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string({
    required_error: "MONGODB_URI is required. Please set MONGODB_URI or MONGODB_URI_DEV/MONGODB_URI_PROD in your .env file.",
  }),
  CLERK_SECRET_KEY: z.string({
    required_error: "CLERK_SECRET_KEY is required. Please set CLERK_SECRET_KEY or CLERK_SECRET_KEY_DEV/CLERK_SECRET_KEY_PROD in your .env file.",
  }),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  API_URL: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  HF_TOKEN: z.string().optional(),
  HF_MODEL: z.string().default("meta-llama/Llama-3.3-70B-Instruct"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PLAN_MANN_SHANTI: z.string().optional(),
  RAZORPAY_PLAN_APNA_THERAPIST: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_URL: z.string().optional(),
});

export const env = envSchema.parse(resolvedEnv);
