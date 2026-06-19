import { google } from "googleapis";
import { getGoogleAuth, isGoogleConfigured } from "@/lib/google";
import { prisma } from "@/lib/prisma";

// Mirrors core tables into a Google Sheet so admins can eyeball data without
// touching the app. This is a one-way push (DB -> Sheet); the sheet is a view,
// not a source of truth. Called after meaningful writes and by the cron job.

async function writeTab(sheets, spreadsheetId, tabName, header, rows) {
  // Ensure the tab exists (ignore "already exists" errors).
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  } catch (_) {
    /* tab already exists — fine */
  }

  // Clear then rewrite the whole tab. Simple and reliable for ~20 vehicles.
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${tabName}!A1:Z10000`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [header, ...rows] },
  });
}

export async function syncToSheets() {
  if (!isGoogleConfigured()) {
    return { skipped: true, reason: "Google not configured" };
  }
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) {
    return { skipped: true, reason: "GOOGLE_SHEETS_ID not set" };
  }

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const vehicles = await prisma.vehicle.findMany({
      include: { assignedDriver: true },
      orderBy: { unitNumber: "asc" },
    });

    await writeTab(
      sheets,
      spreadsheetId,
      "Vehicles",
      [
        "Unit",
        "Plate",
        "Make/Model",
        "Year",
        "Mileage",
        "Driver",
        "Reg Expiry",
        "Inspection",
        "Emissions",
        "Insurance",
        "Last Oil (mi)",
        "WEX",
        "Transponder",
        "Spare",
      ],
      vehicles.map((v) => [
        v.unitNumber || "",
        v.licensePlate,
        [v.make, v.model].filter(Boolean).join(" "),
        v.year || "",
        v.currentMileage,
        v.assignedDriver?.name || "",
        fmt(v.registrationExpiry),
        fmt(v.inspectionExpiry),
        fmt(v.emissionsExpiry),
        fmt(v.insuranceExpiry),
        v.lastOilChangeMileage ?? "",
        v.wexCardId || "",
        v.turnpikeTransponder || "",
        v.isSpare ? "YES" : "",
      ])
    );

    const requests = await prisma.serviceRequest.findMany({
      include: { vehicle: true, driver: true, supervisor: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    await writeTab(
      sheets,
      spreadsheetId,
      "Service Requests",
      [
        "Date",
        "Plate",
        "Driver",
        "Issue",
        "Status",
        "Shop",
        "Scheduled",
        "Logistics",
        "Est. Cost",
        "Invoice",
      ],
      requests.map((r) => [
        fmt(r.createdAt),
        r.vehicle.licensePlate,
        r.driver.name,
        r.issue,
        r.status,
        r.serviceShop || "",
        fmt(r.scheduledFor),
        r.logistics || "",
        r.estimatedCost ?? "",
        r.invoiceDriveUrl || "",
      ])
    );

    return { synced: true, vehicles: vehicles.length, requests: requests.length };
  } catch (err) {
    console.error("[sheets] sync failed:", err.message);
    return { error: err.message };
  }
}

function fmt(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}
