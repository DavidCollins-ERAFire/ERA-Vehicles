import { prisma } from "@/lib/prisma";
import { daysUntil, currentPeriod, formatDate } from "@/lib/utils";
import {
  sendSlackChannelAlert,
  sendSlackDM,
  slackFields,
} from "@/lib/slack";
import { sendEmail, emailLayout } from "@/lib/gmail";

// How far ahead we warn for date-based items (registration, inspection, etc.).
const EXPIRY_LEAD_DAYS = 30;
// How close to the oil interval (in miles) before we nudge the driver.
const OIL_WARN_WITHIN_MI = 500;

// -------------------------------------------------------------------------
// Estimate "miles since last oil change". We don't have live odometer data,
// so we project from the last recorded mileage assuming a daily average.
// avgMilesPerDay is configurable per-fleet via env (default 50).
// -------------------------------------------------------------------------
function projectedMileage(vehicle) {
  const avgPerDay = Number(process.env.FLEET_AVG_MILES_PER_DAY || 50);
  const daysSince = Math.max(
    0,
    Math.floor((Date.now() - new Date(vehicle.mileageAsOf).getTime()) / 86400000)
  );
  return vehicle.currentMileage + daysSince * avgPerDay;
}

// Returns the list of due/overdue items for one vehicle WITHOUT sending alerts.
// Used both by the dashboard (to show badges) and the cron job (to send).
export function computeVehicleAlerts(vehicle) {
  const alerts = [];

  // --- Oil change (synthetic, 4k–6k mi) ---
  if (vehicle.lastOilChangeMileage != null) {
    const dueAt = vehicle.lastOilChangeMileage + (vehicle.oilChangeIntervalMi || 5000);
    const projected = projectedMileage(vehicle);
    const remaining = dueAt - projected;
    if (remaining <= OIL_WARN_WITHIN_MI) {
      alerts.push({
        type: "OIL_CHANGE",
        dueMileage: dueAt,
        dueDate: null,
        overdue: remaining < 0,
        message:
          remaining < 0
            ? `Oil change overdue — projected ~${Math.abs(remaining).toLocaleString()} mi past due (due at ${dueAt.toLocaleString()} mi).`
            : `Oil change due soon — about ${remaining.toLocaleString()} mi remaining (due at ${dueAt.toLocaleString()} mi).`,
      });
    }
  }

  // --- Date-based compliance items ---
  const dateItems = [
    ["REGISTRATION", "Registration", vehicle.registrationExpiry],
    ["INSPECTION", "State inspection", vehicle.inspectionExpiry],
    ["EMISSIONS", "Emissions", vehicle.emissionsExpiry],
    ["INSURANCE", "Insurance", vehicle.insuranceExpiry],
  ];
  for (const [type, label, date] of dateItems) {
    if (!date) continue;
    const d = daysUntil(date);
    if (d !== null && d <= EXPIRY_LEAD_DAYS) {
      alerts.push({
        type,
        dueDate: date,
        dueMileage: null,
        overdue: d < 0,
        message:
          d < 0
            ? `${label} EXPIRED on ${formatDate(date)} (${Math.abs(d)} days ago).`
            : `${label} expires in ${d} days (${formatDate(date)}).`,
      });
    }
  }

  return alerts;
}

// -------------------------------------------------------------------------
// The cron entry point. Walks every active vehicle, finds due items, and for
// any alert we haven't already sent (tracked in MaintenanceReminder), fires
// Slack + email and records it. Idempotent: safe to run daily.
// -------------------------------------------------------------------------
export async function runMaintenanceSweep() {
  const vehicles = await prisma.vehicle.findMany({
    where: { active: true },
    include: { assignedDriver: true },
  });

  const results = { checked: vehicles.length, sent: 0, alerts: [] };

  for (const vehicle of vehicles) {
    const alerts = computeVehicleAlerts(vehicle);

    for (const alert of alerts) {
      // De-dupe: have we already logged this exact milestone?
      const already = await prisma.maintenanceReminder.findFirst({
        where: {
          vehicleId: vehicle.id,
          type: alert.type,
          dueDate: alert.dueDate ? new Date(alert.dueDate) : null,
          dueMileage: alert.dueMileage ?? null,
        },
      });
      if (already) continue;

      const label = vehicle.unitNumber || vehicle.licensePlate;
      const text = `:wrench: *${label}* — ${alert.message}`;

      await sendSlackChannelAlert(
        text,
        slackFields(`Maintenance: ${label}`, [
          { label: "Vehicle", value: `${label} (${vehicle.licensePlate})` },
          { label: "Driver", value: vehicle.assignedDriver?.name || "Unassigned" },
          { label: "Item", value: alert.message },
        ])
      );

      // DM + email the assigned driver, if there is one.
      if (vehicle.assignedDriver) {
        await sendSlackDM(vehicle.assignedDriver.slackId, text);
        await sendEmail({
          to: vehicle.assignedDriver.email,
          subject: `Fleet reminder: ${label}`,
          html: emailLayout(
            `Maintenance reminder — ${label}`,
            `<p>${alert.message}</p>
             <p><strong>Vehicle:</strong> ${label} (${vehicle.licensePlate})</p>`
          ),
        });
      }

      await prisma.maintenanceReminder.create({
        data: {
          vehicleId: vehicle.id,
          type: alert.type,
          dueDate: alert.dueDate ? new Date(alert.dueDate) : null,
          dueMileage: alert.dueMileage ?? null,
          message: alert.message,
        },
      });

      results.sent += 1;
      results.alerts.push({ vehicle: label, ...alert });
    }
  }

  // --- Quarterly review reminder (once per quarter) ---
  const period = currentPeriod();
  const quarterlyKey = `QUARTERLY_REVIEW:${period}`;
  const sentThisQuarter = await prisma.maintenanceReminder.findFirst({
    where: { type: "QUARTERLY_REVIEW", message: quarterlyKey },
  });
  if (!sentThisQuarter && shouldNudgeQuarterly()) {
    await sendSlackChannelAlert(
      `:calendar: *Quarterly vehicle review (${period})* is open. Drivers: please complete your review form.`
    );
    // Anchor the record to the first vehicle so the FK is satisfied; the
    // message string carries the period for de-duping.
    if (vehicles[0]) {
      await prisma.maintenanceReminder.create({
        data: {
          vehicleId: vehicles[0].id,
          type: "QUARTERLY_REVIEW",
          message: quarterlyKey,
        },
      });
    }
    results.sent += 1;
    results.alerts.push({ vehicle: "ALL", type: "QUARTERLY_REVIEW", message: quarterlyKey });
  }

  return results;
}

// Nudge for the quarterly review during the first 10 days of each quarter.
function shouldNudgeQuarterly() {
  const now = new Date();
  const startMonth = Math.floor(now.getMonth() / 3) * 3;
  const quarterStart = new Date(now.getFullYear(), startMonth, 1);
  const daysIntoQuarter = Math.floor((now - quarterStart) / 86400000);
  return daysIntoQuarter <= 10;
}
