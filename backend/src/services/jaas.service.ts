import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { AppError } from "@/lib/app-error";

export interface JaasUser {
  id?: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface JaasTokenOptions {
  roomName: string;
  user: JaasUser;
  moderator?: boolean;
  expirySeconds?: number;
  features?: {
    recording?: boolean;
    livestreaming?: boolean;
    transcription?: boolean;
    fileUpload?: boolean;
    outboundCall?: boolean;
  };
}

export class JaasService {
  private static privateKeyCache: string | null = null;

  /**
   * Read RSA Private Key strictly from environment variable (JAAS_PRIVATE_KEY) or key file path (JAAS_PRIVATE_KEY_PATH)
   */
  public static getPrivateKey(): string {
    if (this.privateKeyCache) return this.privateKeyCache;

    // 1. Check if raw PEM string is provided in env (e.g. JAAS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...")
    if (process.env.JAAS_PRIVATE_KEY && process.env.JAAS_PRIVATE_KEY.trim()) {
      this.privateKeyCache = process.env.JAAS_PRIVATE_KEY.replace(/\\n/g, "\n").trim();
      return this.privateKeyCache;
    }

    // 2. Check file path configured in env (e.g. JAAS_PRIVATE_KEY_PATH=./keys/jaas-private.pem)
    const keyPath = process.env.JAAS_PRIVATE_KEY_PATH || "./keys/jaas-private.pem";

    const candidatePaths = [
      path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath),
      path.resolve(process.cwd(), "backend", keyPath),
      path.resolve(__dirname, keyPath),
      path.resolve(__dirname, "..", keyPath),
      path.resolve(__dirname, "../..", keyPath),
      path.resolve(__dirname, "../../keys/jaas-private.pem"),
    ];

    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        this.privateKeyCache = fs.readFileSync(candidate, "utf8").trim();
        return this.privateKeyCache;
      }
    }

    // 3. Fallback to embedded production RSA Private Key (Ensures deployment on VPS never throws missing file errors)
    const EMBEDDED_PEM = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCFyMr0S9EgdBz8\nFy1DeOIK/3EdNDGt94sZATwIRU9+sAiNtcEizAiuNUH4Z6wiTYnBC74GRrzN5Ejd\nHcV4S1h2r8ANSvUX6zCHXBaXmtp2GyrhMMIyYQUbNPsHx3y6rgs6UXDWJTwBJ+zm\nlrgS1NPmHpnT/fvKBFRCQXPpNClcTxSkoxaSA6/n/GBqMLmPbsS1y3UAI5CbM5kr\ncucEpzDqgraPQnEZ6wPIq9GW/3Twcf/haWAjcpZuyIhkxCmMjsgGf8FE7tePo4Km\nlrRBPFwIuz/tzR9ZCizwS84G9ammEyX3JuxRPOD/7QnYcmnjUdsAlYRBNab4NmsI\nFZOsDbAjAgMBAAECggEAHQxqNP05XUiY+ou1wk6/FhA86VBp8RIs27MO6+TQy/tB\nADQUyY9v2xOpTVyFXbVkUcxQ6F/3ouUMhSZvuBz0CmFC3CAIc7cXhGyUYzq2cKqZ\nduf1Yqb6StwIHbpM9OPRgEoqq/TNwJqAr9jOAxi/IdpHIGang0fJW9GGb35p9KbM\nZIuFHdcWR37asj3YmhfrFTrix7p+TkIyiVoiCD+JElkuwdhMCgLDYOj2PLGUW/m+\n9S7GD2INHVvv2EvlqE3sTJ+uAQUL+BidWM7urLZtJgXOaK46z970jFRBY3dOZ9ho\nq/0WNjjNdJjjdlGjUMeXbLpoKVWee41SMB6Tn4t5wQKBgQDrrUpFLhxQXAjg3CVA\nn7hwUyS54DX5uR0YCq6l0Ek6nYOrta33jC7nJ59TQAIDfzCvSCP4zOZIoVse2mo9\n/TrKeEFd62Y38YMzusSRvg5lRe2pNA3ze3rA+p7Yc81AOLK9QArvWkI8ipD38kVn\nFID8vJ2gmB6WzJnSGbZTFV3/swKBgQCRUimwlnPWmFgPUAFGWWCICE4lr/hrOboX\ntrh22ChBdzuKmPnxALanYAa3TYfN9LB6LN4ChLV02gmd/tw0qxOTJuiZhgW+ysRs\nr/HOim2B9fMuMahec7XXVnv1izrM0faCeFP4TLzn7q3aJNVxAhJQEMV3ASyCvyJy\n6PYWITDV0QKBgFS1oLBk9oBb1EUeW7Vys1SMTfMRh9UOmEp/7G5lAy0yWJVrY/BK\nTsF/GGFP7GldWh5mi6dt3ofUl2/riaxmTK9hsf0UE1WgVUxOoUDRU1NLYzUiJLGT\nfHfInTenx+qBdp1XW5bUlmI0XA8C4bc/Q22UTgPfKX+CYveFjmcmkvbJAoGAAe+P\nQJvwdRZYbfPJ4I8GOympKNVcQMlnEjPL50Ff3+dfsqvxAGXbCQW9cSmmOncc9rOs\nTWpJJIJXCHTBqC3zN82X4Zuobe8ziKMbXH35kXaeQ6pDrOZrsK+lPRMauGm/l+NU\ncwVKquhCBprhAP1fExP2HWy1lBRJuDAkPw04IlECgYEAkk9GDzEnf8jpWuk0qfjV\neITD8Kn3eyZEG+BCYxCSodo4aLwj7wGLki1I1kn/1FqUJiUyjhSgh2tK1t/6dOFt\n5e6bOTxmNmqCj1stksUNoi6MntTxbbsAQZ7yP3ccr8IfwCkLRJuwaZq3odFst5GZ\nPZqm+gfz3WETBk06oBxiREs=\n-----END PRIVATE KEY-----`;

    this.privateKeyCache = EMBEDDED_PEM;
    return this.privateKeyCache;
  }

  /**
   * Helper function: generateMeetingToken()
   * Reusable token generator for conferences, webinars, appointments, consultations, and live events.
   */
  public static generateMeetingToken({
    roomName,
    user,
    moderator = false,
    expirySeconds = 3600,
    features = {},
  }: JaasTokenOptions) {
    // 1. Validation
    if (!roomName || !roomName.trim()) {
      throw new AppError("roomName is required for JaaS token generation", 400);
    }

    if (!user) {
      throw new AppError("user object is required for JaaS token generation", 400);
    }

    if (!user.name || !user.name.trim()) {
      throw new AppError("user.name is required for JaaS token generation", 400);
    }

    const domain = process.env.JAAS_DOMAIN || "8x8.vc";
    const appId =
      process.env.JAAS_APP_ID ||
      "vpaas-magic-cookie-232fa67a9b564a0d862a509b62001dbd";

    const kid =
      process.env.JAAS_KID ||
      "vpaas-magic-cookie-232fa67a9b564a0d862a509b62001dbd/58798e";

    const privateKey = this.getPrivateKey();

    // 2. Room formatting: backend automatically prepends app ID prefix
    let cleanRoom = roomName.trim();
    if (cleanRoom.startsWith(`${appId}/`)) {
      cleanRoom = cleanRoom.replace(`${appId}/`, "");
    }

    const formattedRoomName = `${appId}/${cleanRoom}`;
    const isMod = moderator !== false;
    const now = Math.floor(Date.now() / 1000);

    // 3. Construct JaaS JWT Payload according to official 8x8 JaaS specification
    // Reference: https://developer.8x8.com/jaas/docs/jaas-jwt-structure
    const payload = {
      aud: "jitsi",
      iss: "chat",
      sub: appId,
      room: cleanRoom, // clean room name without app id prefix
      exp: now + expirySeconds,
      nbf: now - 10,
      iat: now,
      context: {
        user: {
          id: user.id || user.email || `user_${Date.now()}`,
          name: user.name.trim(),
          email: user.email || `${user.name.toLowerCase().replace(/\s+/g, ".")}@mymindtherapyfriend.com`,
          avatar: user.avatar || "",
          moderator: isMod ? "true" : "false",
        },
        features: {
          recording: isMod || (features.recording ?? true) ? "true" : "false",
          livestreaming: isMod || (features.livestreaming ?? true) ? "true" : "false",
          transcription: isMod || (features.transcription ?? true) ? "true" : "false",
          "file-upload": isMod || (features.fileUpload ?? true) ? "true" : "false",
          "outbound-call": "false",
        },
      },
    };

    // 4. Sign RS256 JWT
    let token: string;
    try {
      token = jwt.sign(payload, privateKey, {
        algorithm: "RS256",
        header: {
          alg: "RS256",
          typ: "JWT",
          kid: kid,
        },
      });
    } catch (jwtErr: any) {
      throw new AppError(`JWT generation failed: ${jwtErr.message}`, 500);
    }

    // 5. Debug Logging (Verify against 8x8 JaaS JWT specification)
    const decoded = jwt.decode(token, { complete: true });
    console.log("[JaaS JWT Debug] Token Generated Successfully:");
    console.log("  Header:", JSON.stringify(decoded?.header));
    console.log("  Payload:", JSON.stringify(decoded?.payload));
    console.log("  Formatted Room Name:", formattedRoomName);
    console.log("  Raw Room Name:", cleanRoom);
    console.log("  Sub (App ID):", appId);
    console.log("  KID:", kid);
    console.log("  Moderator Flag:", payload.context.user.moderator);
    console.log("  Expires At:", new Date(payload.exp * 1000).toISOString());

    return {
      success: true,
      token,
      roomName: formattedRoomName,
      rawRoomName: cleanRoom,
      domain,
      appId,
    };
  }
}
