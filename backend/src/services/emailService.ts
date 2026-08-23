import nodemailer from "nodemailer";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  })[character] as string);
}

function getTransporter() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const port = Number(process.env.SMTP_PORT || 587);

  if (!host || !user || !pass) {
    throw new Error("Email service is not configured");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export async function sendPasswordResetEmail(
  recipientEmail: string,
  recipientName: string,
  resetUrl: string
) {
  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim();
  const safeRecipientName = escapeHtml(recipientName);

  if (!from) {
    throw new Error("EMAIL_FROM is missing");
  }

  await getTransporter().sendMail({
    from: `ReStyle <${from}>`,
    to: recipientEmail,
    subject: "Reset your ReStyle password",
    text: `Hi ${recipientName},\n\nUse this link to reset your ReStyle password:\n${resetUrl}\n\nThis link expires in one hour. If you did not request a password reset, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2d2d2d">
        <h1 style="color:#b45c6d">ReStyle</h1>
        <h2>Reset your password</h2>
        <p>Hi ${safeRecipientName},</p>
        <p>We received a request to reset your ReStyle password.</p>
        <p style="margin:28px 0">
          <a href="${resetUrl}" style="padding:13px 22px;border-radius:8px;background:#b45c6d;color:white;text-decoration:none;font-weight:bold">Reset Password</a>
        </p>
        <p>This link expires in one hour. If you did not request this, you can safely ignore this email.</p>
      </div>
    `
  });
}
