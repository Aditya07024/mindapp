import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"MyMindTherapyFriend" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`;

/** Shared styled HTML wrapper */
function htmlWrap(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">🧠 MyMindTherapyFriend</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f1f5f9;padding:20px 36px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                © 2025 MyMindTherapyFriend · Mental Wellness Platform<br/>
                This is an automated notification. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Send new booking notification to therapist */
export async function sendBookingNotificationToTherapist(opts: {
  therapistEmail: string;
  therapistName: string;
  seekerName: string;
  slot: Date;
  fee: number;
  bookingId: string;
}): Promise<void> {
  const { therapistEmail, therapistName, seekerName, slot, fee, bookingId } = opts;

  const formattedSlot = slot.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">New Session Booked! 🎉</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">You have a new appointment request on MyMindTherapyFriend.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                <span style="font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Client</span>
                <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0f172a;">${seekerName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                <span style="font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Session Date &amp; Time</span>
                <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0f172a;">📅 ${formattedSlot} IST</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;">
                <span style="font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Session Fee</span>
                <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0d9488;">₹${fee.toLocaleString("en-IN")}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#065f46;font-weight:600;">
        ✅ The session will be confirmed once payment is received from the client. You will receive another notification when confirmed.
      </p>
    </div>

    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">
      Log in to your MyMindTherapyFriend dashboard to view details, prepare AI briefs, and manage your schedule.
    </p>

    <a href="https://mymindtherapyfriend.com/therapist/dashboard"
       style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">
      View Dashboard →
    </a>

    <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">Booking ID: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;">${bookingId}</code></p>
  `;

  await transporter.sendMail({
    from: FROM,
    to: therapistEmail,
    subject: `📅 New Booking from ${seekerName} — MyMindTherapyFriend`,
    html: htmlWrap("New Booking Notification", body),
  });
}

/** Send booking confirmation to user/seeker */
export async function sendBookingConfirmationToSeeker(opts: {
  seekerEmail: string;
  seekerName: string;
  therapistName: string;
  slot: Date;
  fee: number;
  bookingId: string;
}): Promise<void> {
  const { seekerEmail, seekerName, therapistName, slot, fee, bookingId } = opts;

  const formattedSlot = slot.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">Booking Confirmed! 🌟</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Hi ${seekerName}, your therapy session has been successfully reserved.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                <span style="font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Therapist</span>
                <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0f172a;">Dr. ${therapistName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                <span style="font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Session Date &amp; Time</span>
                <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0f172a;">📅 ${formattedSlot} IST</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;">
                <span style="font-size:13px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Session Fee</span>
                <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#0d9488;">₹${fee.toLocaleString("en-IN")}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#92400e;font-weight:600;">
        ⏳ Please complete payment to confirm your session. The slot is reserved for 30 minutes.
      </p>
    </div>

    <a href="https://mymindtherapyfriend.com/user/dashboard"
       style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">
      Complete Payment →
    </a>

    <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">Booking ID: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;">${bookingId}</code></p>
  `;

  await transporter.sendMail({
    from: FROM,
    to: seekerEmail,
    subject: `✅ Your session with Dr. ${therapistName} is reserved — MyMindTherapyFriend`,
    html: htmlWrap("Booking Confirmation", body),
  });
}

/** Send payment confirmed email to therapist */
export async function sendPaymentConfirmedToTherapist(opts: {
  therapistEmail: string;
  therapistName: string;
  seekerName: string;
  slot: Date;
  fee: number;
  bookingId: string;
}): Promise<void> {
  const { therapistEmail, therapistName, seekerName, slot, fee, bookingId } = opts;
  const netPayout = Math.round(fee * 0.70);

  const formattedSlot = slot.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">Payment Received! 💰</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Great news, Dr. ${therapistName}! Your client has paid for the upcoming session.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Client</span>
            <p style="margin:3px 0 0;font-size:15px;font-weight:700;color:#0f172a;">${seekerName}</p>
          </td></tr>
          <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Session Slot</span>
            <p style="margin:3px 0 0;font-size:15px;font-weight:700;color:#0f172a;">📅 ${formattedSlot} IST</p>
          </td></tr>
          <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Gross Fee</span>
            <p style="margin:3px 0 0;font-size:15px;font-weight:700;color:#0f172a;">₹${fee.toLocaleString("en-IN")}</p>
          </td></tr>
          <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Platform Fee (30%)</span>
            <p style="margin:3px 0 0;font-size:15px;font-weight:700;color:#ef4444;">-₹${Math.round(fee * 0.30).toLocaleString("en-IN")}</p>
          </td></tr>
          <tr><td style="padding:6px 0;">
            <span style="font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Your Payout (70%)</span>
            <p style="margin:3px 0 0;font-size:18px;font-weight:800;color:#0d9488;">₹${netPayout.toLocaleString("en-IN")}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>

    <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#065f46;font-weight:600;">
        ✅ Session is now CONFIRMED. Please be ready 5 minutes before the scheduled time.
      </p>
    </div>

    <a href="https://mymindtherapyfriend.com/therapist/dashboard"
       style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">
      Go to Dashboard →
    </a>

    <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">Booking ID: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px;">${bookingId}</code></p>
  `;

  await transporter.sendMail({
    from: FROM,
    to: therapistEmail,
    subject: `💰 Payment Confirmed — Session with ${seekerName} · MyMindTherapyFriend`,
    html: htmlWrap("Payment Confirmed", body),
  });
}

export default { sendBookingNotificationToTherapist, sendBookingConfirmationToSeeker, sendPaymentConfirmedToTherapist };
