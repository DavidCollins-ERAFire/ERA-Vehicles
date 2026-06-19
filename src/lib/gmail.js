import { google } from "googleapis";
import { getGmailAuth, isGoogleConfigured } from "@/lib/google";

// Builds an RFC-2822 message and base64url-encodes it the way the Gmail API
// expects. Supports multiple "to" recipients.
function buildRawMessage({ from, to, subject, html }) {
  const recipients = Array.isArray(to) ? to.join(", ") : to;
  const lines = [
    `From: ERA Fleet <${from}>`,
    `To: ${recipients}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ];
  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Sends an email and returns { sent: true } or a skip/error object. Callers
// should never let a failed email block the core action (request saved, etc.).
export async function sendEmail({ to, subject, html }) {
  if (!isGoogleConfigured()) {
    return { skipped: true, reason: "Google not configured" };
  }
  const sender = process.env.GMAIL_SENDER;
  if (!sender) {
    return { skipped: true, reason: "GMAIL_SENDER not set" };
  }

  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) {
    return { skipped: true, reason: "no recipients" };
  }

  try {
    const auth = getGmailAuth(sender);
    const gmail = google.gmail({ version: "v1", auth });
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: buildRawMessage({ from: sender, to: recipients, subject, html }),
      },
    });
    return { sent: true };
  } catch (err) {
    console.error("[gmail] send failed:", err.message);
    return { error: err.message };
  }
}

// Small shared wrapper so every system email has consistent ERA branding.
export function emailLayout(title, bodyHtml) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
    <div style="background:#800020;padding:16px 20px">
      <span style="color:#FFD700;font-size:18px;font-weight:bold;letter-spacing:.5px">ERA FLEET</span>
    </div>
    <div style="padding:20px;color:#222;font-size:14px;line-height:1.6">
      <h2 style="margin:0 0 12px;color:#800020;font-size:18px">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:12px 20px;background:#faf7f8;color:#888;font-size:12px">
      Automated message from ERA Fleet Management.
    </div>
  </div>`;
}
