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
  // 1. Try Google OAuth2 first (uses HTTPS API, not blocked by Render/cloud firewalls)
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
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
        tls: {
          rejectUnauthorized: false,
        },
      };

      return nodemailer.createTransport(oauthTransportOptions);
    } catch (error) {
      console.warn("[Mail] Google OAuth token retrieval failed, falling back to SMTP:", error);
    }
  }

  // 2. Fallback to standard SMTP (Port 465 SSL or 587 TLS)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT) || 465;
    const smtpTransportOptions: SMTPTransport.Options = {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465 || process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
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

export async function sendPasswordResetEmail(email: string, newPassword: string) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.warn("Mail transporter not configured. Cannot send password reset to:", email);
    return false;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || process.env.SMTP_USER || "noreply@mymindtherapyfriend.com",
    to: email,
    subject: "Your New Password - MyMindTherapyFriend",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #faf9f6;">
        <h2 style="color: #2e6e65; text-align: center; margin-bottom: 20px;">MyMindTherapyFriend</h2>
        <p style="color: #334155; font-size: 15px;">Hello,</p>
        <p style="color: #334155; font-size: 15px;">We received a request to reset your password. Here is your temporary new password:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #2e6e65; background: #e6f2f0; padding: 12px 24px; border-radius: 8px; display: inline-block;">
            ${newPassword}
          </span>
        </div>
        <p style="color: #334155; font-size: 14px;">Please sign in to the app using this new password.</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          If you did not request a password reset, please contact support immediately.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email successfully sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`Error sending password reset email to ${email}:`, error);
    return false;
  }
}

export async function sendOtpEmail(email: string, otp: string) {
  const transporter = await createTransporter();
  if (!transporter) {
    console.warn("[Mail] Mail transporter not configured. Cannot send OTP to:", email);
    return false;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || process.env.SMTP_USER || "noreply@mymindtherapyfriend.com",
    to: email,
    subject: "Verify Your Account - MyMindTherapyFriend OTP",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #faf9f6;">
        <h2 style="color: #2e6e65; text-align: center; margin-bottom: 8px;">MyMindTherapyFriend</h2>
        <h3 style="color: #1e293b; text-align: center; font-size: 18px; margin-top: 0;">Verify Your Email Address</h3>
        <p style="color: #334155; font-size: 15px;">Welcome! Please use the following 6-digit OTP code to verify your account registration:</p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2e6e65; background: #e6f2f0; padding: 14px 28px; border-radius: 10px; display: inline-block; border: 1px solid #b2dfdb;">
            ${otp}
          </span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This verification code is valid for <strong>10 minutes</strong>. If you did not request this account registration, please ignore this email.</p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
          MyMindTherapyFriend Mental Health & Wellness Platform
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Mail] Verification OTP email successfully sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`[Mail] Error sending OTP email to ${email}:`, error);
    console.log(`[Mail Fallback Log] Verification OTP for ${email}: ${otp}`);
    return false;
  }
}


