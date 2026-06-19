import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { uploadInvoiceToDrive } from "@/lib/drive";
import { sendSlackDM, sendSlackChannelAlert, slackFields } from "@/lib/slack";
import { sendEmail, emailLayout } from "@/lib/gmail";
import { syncToSheets } from "@/lib/sheets";
import { formatDateTime } from "@/lib/utils";

const LOGISTICS_LABEL = {
  RIDING_WITH: "Riding with",
  SPARE_VEHICLE: "Spare vehicle",
  OFFICE_DUTY: "Office duty",
};

export async function GET(req, { params }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const request = await prisma.serviceRequest.findUnique({
    where: { id: params.id },
    include: { vehicle: true, driver: true, supervisor: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(request);
}

// PATCH handles three actions, dispatched by `action`:
//   schedule        (MANAGER)            — Workflow B
//   complete        (MANAGER, multipart) — Workflow C, optional invoice upload
//   flag-conflict   (SUPERVISOR/MANAGER) — supervisor conflict flag
export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.serviceRequest.findUnique({
    where: { id: params.id },
    include: { vehicle: true, driver: true, supervisor: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") || "";

  // ---- Workflow C: completion (may include a file upload) -----------------
  if (contentType.includes("multipart/form-data")) {
    if (session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Managers only" }, { status: 403 });
    }
    const form = await req.formData();
    const estimatedCost = form.get("estimatedCost");
    const file = form.get("invoice");

    let invoiceDriveId = existing.invoiceDriveId;
    let invoiceDriveUrl = existing.invoiceDriveUrl;

    if (file && typeof file === "object" && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const safeName = `${existing.vehicle.licensePlate}_${Date.now()}_${file.name}`.replace(
        /[^\w.\-]/g,
        "_"
      );
      const uploaded = await uploadInvoiceToDrive({
        buffer,
        filename: safeName,
        mimeType: file.type,
      });
      if (uploaded?.id) {
        invoiceDriveId = uploaded.id;
        invoiceDriveUrl = uploaded.webViewLink;
      }
    }

    const updated = await prisma.serviceRequest.update({
      where: { id: params.id },
      data: {
        status: "COMPLETE",
        completedAt: new Date(),
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : existing.estimatedCost,
        invoiceDriveId,
        invoiceDriveUrl,
      },
      include: { vehicle: true, driver: true, supervisor: true },
    });

    syncToSheets().catch(() => {});
    return NextResponse.json(updated);
  }

  // ---- JSON actions -------------------------------------------------------
  const body = await req.json();
  const action = body.action;

  if (action === "schedule") {
    if (session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Managers only" }, { status: 403 });
    }
    const { serviceShop, scheduledFor, logistics, logisticsDetail } = body;

    const updated = await prisma.serviceRequest.update({
      where: { id: params.id },
      data: {
        status: "SCHEDULED",
        serviceShop,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        logistics: logistics || null,
        logisticsDetail: logisticsDetail || null,
        conflictFlag: false,
        conflictNote: null,
      },
      include: { vehicle: true, driver: true, supervisor: true },
    });

    // --- Notify driver + supervisor (Workflow B) ---
    const logisticsText = updated.logistics
      ? `${LOGISTICS_LABEL[updated.logistics]}${updated.logisticsDetail ? `: ${updated.logisticsDetail}` : ""}`
      : "—";
    const summary = `*${updated.vehicle.licensePlate}* scheduled at *${updated.serviceShop}* for *${formatDateTime(updated.scheduledFor)}*. Logistics: ${logisticsText}.`;
    const blocks = slackFields("Service Scheduled", [
      { label: "Vehicle", value: updated.vehicle.licensePlate },
      { label: "Shop", value: updated.serviceShop || "—" },
      { label: "When", value: formatDateTime(updated.scheduledFor) },
      { label: "Logistics", value: logisticsText },
    ]);

    await sendSlackDM(updated.driver.slackId, `:calendar: ${summary}`, blocks);
    if (updated.supervisor) {
      await sendSlackDM(updated.supervisor.slackId, `:calendar: ${summary}`, blocks);
    }

    const emailHtml = emailLayout("Service Scheduled", `
      <p><strong>Vehicle:</strong> ${updated.vehicle.licensePlate}</p>
      <p><strong>Shop:</strong> ${updated.serviceShop || "—"}</p>
      <p><strong>When:</strong> ${formatDateTime(updated.scheduledFor)}</p>
      <p><strong>Logistics:</strong> ${logisticsText}</p>
    `);
    await sendEmail({
      to: [updated.driver.email, updated.supervisor?.email].filter(Boolean),
      subject: `Service scheduled — ${updated.vehicle.licensePlate}`,
      html: emailHtml,
    });

    syncToSheets().catch(() => {});
    return NextResponse.json(updated);
  }

  if (action === "complete") {
    if (session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "Managers only" }, { status: 403 });
    }
    const updated = await prisma.serviceRequest.update({
      where: { id: params.id },
      data: {
        status: "COMPLETE",
        completedAt: new Date(),
        estimatedCost: body.estimatedCost != null ? parseFloat(body.estimatedCost) : existing.estimatedCost,
      },
      include: { vehicle: true, driver: true, supervisor: true },
    });
    syncToSheets().catch(() => {});
    return NextResponse.json(updated);
  }

  if (action === "flag-conflict") {
    if (!["SUPERVISOR", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Supervisors only" }, { status: 403 });
    }
    const updated = await prisma.serviceRequest.update({
      where: { id: params.id },
      data: { conflictFlag: true, conflictNote: body.conflictNote || "Scheduling conflict flagged." },
      include: { vehicle: true, driver: true, supervisor: true },
    });

    await sendSlackChannelAlert(
      `:warning: Scheduling conflict flagged for *${updated.vehicle.licensePlate}* by ${session.user.name}: ${updated.conflictNote}`
    );
    const managers = await prisma.user.findMany({
      where: { role: "MANAGER", active: true },
      select: { email: true },
    });
    await sendEmail({
      to: managers.map((m) => m.email),
      subject: `Scheduling conflict — ${updated.vehicle.licensePlate}`,
      html: emailLayout("Scheduling Conflict Flagged", `
        <p><strong>Vehicle:</strong> ${updated.vehicle.licensePlate}</p>
        <p><strong>Flagged by:</strong> ${session.user.name}</p>
        <p><strong>Note:</strong> ${updated.conflictNote}</p>
      `),
    });

    syncToSheets().catch(() => {});
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
