import { AccessToken } from "livekit-server-sdk";

const LIVEKIT_URL = process.env.LIVEKIT_URL!;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;

export interface TokenGrantOptions {
  roomName: string;
  userName: string;
  userId: string;
  canPublish?: boolean;
  canPublishData?: boolean;
  canSubscribe?: boolean;
  duration?: number; // in seconds, default 2 hours
}

export class LiveKitService {
  /**
   * Generate an access token for a LiveKit room
   */
  static async generateToken(options: TokenGrantOptions): Promise<string> {
    const {
      roomName,
      userName,
      userId,
      canPublish = true,
      canPublishData = true,
      canSubscribe = true,
      duration = 7200, // 2 hours default
    } = options;

    try {
      const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: userId,
        name: userName,
        ttl: duration,
      });
      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish,
        canPublishData,
        canSubscribe,
      });

      return await at.toJwt();
    } catch (error) {
      console.error("Failed to generate LiveKit token:", error);
      throw new Error("Failed to generate video room token");
    }
  }

  /**
   * Get LiveKit URL
   */
  static getLiveKitURL(): string {
    return LIVEKIT_URL;
  }

  /**
   * Check if LiveKit is configured
   */
  static isConfigured(): boolean {
    return !!(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
  }
}

export default LiveKitService;
