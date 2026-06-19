import { google } from "googleapis";
import { Readable } from "stream";
import { getGoogleAuth, isGoogleConfigured } from "@/lib/google";

// Uploads an invoice/receipt to the configured Drive folder and returns the
// file id + a shareable view link. Buffer in, no temp file on local disk —
// which is the whole point (keeps the Pi's SD card free of large uploads).
export async function uploadInvoiceToDrive({ buffer, filename, mimeType }) {
  if (!isGoogleConfigured()) {
    return { skipped: true, reason: "Google not configured" };
  }

  const folderId = process.env.GOOGLE_DRIVE_INVOICE_FOLDER_ID;
  if (!folderId) {
    return { skipped: true, reason: "GOOGLE_DRIVE_INVOICE_FOLDER_ID not set" };
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType || "application/octet-stream",
      body: Readable.from(buffer),
    },
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: res.data.id,
    name: res.data.name,
    webViewLink: res.data.webViewLink,
  };
}
