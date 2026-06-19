import { google } from "googleapis";

// All Google server-to-server calls (Drive uploads, Sheets sync, system email)
// authenticate with a single service account so they work in background/cron
// contexts with no user logged in.
//
// The key can be supplied two ways (pick whichever is easier to deploy):
//   1. GOOGLE_SERVICE_ACCOUNT_KEY  -> the raw JSON, base64-encoded (good for env-only hosts)
//   2. GOOGLE_SERVICE_ACCOUNT_FILE -> a path to the .json key on disk (good for a Pi)

function loadServiceAccount() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (b64) {
    try {
      return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    } catch (err) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_KEY is set but is not valid base64-encoded JSON."
      );
    }
  }

  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file) {
    // Loaded lazily so the bundler doesn't try to read the file at build time.
    const fs = require("fs");
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  throw new Error(
    "No Google service account configured. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_FILE."
  );
}

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/gmail.send",
];

// A normal service-account client (Drive + Sheets).
export function getGoogleAuth() {
  const key = loadServiceAccount();
  return new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
  });
}

// A delegated client that can send email *as* a real mailbox in your Workspace.
// Requires domain-wide delegation to be enabled for the service account and the
// `subject` mailbox (e.g. fleet@erafire.com) authorized for the gmail.send scope.
export function getGmailAuth(subject) {
  const key = loadServiceAccount();
  return new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    subject: subject || process.env.GMAIL_SENDER,
  });
}

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_SERVICE_ACCOUNT_FILE
  );
}
