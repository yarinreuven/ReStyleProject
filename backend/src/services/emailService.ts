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

export async function sendEmailChangeCode(
  recipientEmail: string,
  recipientName: string,
  verificationCode: string
) {
  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim();
  const safeRecipientName = escapeHtml(recipientName);

  if (!from) throw new Error("EMAIL_FROM is missing");

  await getTransporter().sendMail({
    from: `ReStyle <${from}>`,
    to: recipientEmail,
    subject: "Verify your new ReStyle email",
    text: `Hi ${recipientName},\n\nYour ReStyle verification code is: ${verificationCode}\n\nThis code expires in 15 minutes. If you did not request this change, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2d2d2d">
        <h1 style="color:#b45c6d">ReStyle</h1>
        <h2>Verify your new email</h2>
        <p>Hi ${safeRecipientName},</p>
        <p>Enter this code in your ReStyle account settings:</p>
        <p style="margin:26px 0;font-size:32px;font-weight:bold;letter-spacing:8px;color:#b45c6d">${verificationCode}</p>
        <p>This code expires in 15 minutes. If you did not request this change, you can ignore this email.</p>
      </div>
    `
  });
}

export async function sendPaymentReceiptEmail(
  recipientEmail: string,
  recipientName: string,
  receipt: {
    orderId: string;
    planName: string;
    credits: number;
    amount: string;
    currency: string;
    paidAt: Date;
  }
) {
  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim();
  if (!from) throw new Error("EMAIL_FROM is missing");

  const safeName = escapeHtml(recipientName);
  const safeOrderId = escapeHtml(receipt.orderId);
  const safePlanName = escapeHtml(receipt.planName);
  const paidAt = receipt.paidAt.toLocaleString("en-IL", { timeZone: "Asia/Jerusalem" });
  const total = `${receipt.amount} ${receipt.currency}`;

  await getTransporter().sendMail({
    from: `ReStyle <${from}>`,
    to: recipientEmail,
    subject: "Your ReStyle payment receipt (PayPal Sandbox)",
    text: `Hi ${recipientName},\n\nYour PayPal Sandbox payment was approved successfully and the credits were added to your ReStyle account.\nPackage: ${receipt.planName}\nTry-on credits: ${receipt.credits}\nAmount: ${total}\nOrder ID: ${receipt.orderId}\nDate: ${paidAt}\n\nThis was a Sandbox test payment. No real money was charged.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#3b3034;line-height:1.6">
        <h1 style="margin-bottom:6px;color:#b45c6d">ReStyle</h1>
        <h2 style="margin-top:0">Your payment was approved</h2>
        <p>Hi ${safeName},</p>
        <p>PayPal confirmed your payment and the credits were added to your ReStyle account.</p>
        <div style="margin:24px 0;padding:18px;border-radius:12px;background:#faeef1">
          <p style="margin:0 0 7px"><strong>Package:</strong> ${safePlanName}</p>
          <p style="margin:0 0 7px"><strong>Try-on credits:</strong> ${receipt.credits}</p>
          <p style="margin:0 0 7px"><strong>Amount:</strong> ${total}</p>
          <p style="margin:0 0 7px"><strong>Order ID:</strong> ${safeOrderId}</p>
          <p style="margin:0"><strong>Date:</strong> ${paidAt}</p>
        </div>
        <p style="padding:12px;border-radius:8px;background:#fff6d9;color:#6b5520">
          This was a PayPal Sandbox test payment. No real money was charged.
        </p>
      </div>
    `
  });
}
