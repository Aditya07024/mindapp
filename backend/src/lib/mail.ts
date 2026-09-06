import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { google } from "googleapis";

const { OAuth2 } = google.auth;

const oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground",
);

if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
}

export async function createTransporter() {
  if (
    process.env.EMAIL_USER &&
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  ) {
    try {
      const accessTokenResponse = await oauth2Client.getAccessToken();
      const accessToken =
        typeof accessTokenResponse === "string"
          ? accessTokenResponse
          : accessTokenResponse?.token;

      const oauthTransportOptions: SMTPTransport.Options = {
        service: "gmail",
        auth: {
          type: "OAUTH2",
          user: process.env.EMAIL_USER,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
          accessToken: accessToken ?? undefined,
        },
        tls: {
          rejectUnauthorized: false,
        },
      };

      return nodemailer.createTransport(oauthTransportOptions);
    } catch (error) {
      console.warn("[Mail] Google OAuth token retrieval failed, trying SMTP fallback...", error);
    }
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const smtpTransportOptions: SMTPTransport.Options = {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    };

    return nodemailer.createTransport(smtpTransportOptions);
  }

  return null;
}

export async function sendInviteEmail(email: string, orgName: string, originUrl?: string) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.warn("Mail transporter not configured. Cannot send invite to:", email);
    return false;
  }

  const joinUrl = originUrl || process.env.FRONTEND_URL || "https://mymindtherapyfriend.com";
  const mailOptions = {
    from: process.env.EMAIL_USER || process.env.SMTP_USER || "noreply@mymindtherapyfriend.com",
    to: email,
    subject: `Invitation to join MyMindTherapyFriend under ${orgName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; text-align: center;">Join MyMindTherapyFriend</h2>
        <p>Hello,</p>
        <p>You have been whitelisted by <strong>${orgName}</strong> to join the MyMindTherapyFriend mental health and wellness platform.</p>
        <p>By signing up, you will get access to corporate wellness benefits, counseling bookings, and mood tracking tools provided by your organization.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${joinUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Join Now</a>
        </div>
        <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 40px;">
          If you did not expect this invitation, please ignore this email.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Invite email sent to: ${email}`);
    return true;
  } catch (error) {
    console.error(`Error sending invite email to ${email}:`, error);
    return false;
  }
}
