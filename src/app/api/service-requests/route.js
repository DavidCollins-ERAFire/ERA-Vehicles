import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendSlackChannelAlert, slackFields } from "@/lib/slack";
import { sendEmail, emailLayout } from "@/lib/gmail";
import { syncToSheets } from "@/lib/sheets";

// GET /api/service-requests
// Drivers see their own; supervisors see their reports'; managers see all.
export async function GET(req) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where = {};
  if (status) where.status = status;
  if (session.user.role === "DRIVER") where.driverId = session.user.id;
  if (session.user.role === "SUPERVISOR") where.supervisorId = session.user.id;

  const requests = await prisma.serviceRequest.findMany({
    where,
    include: { vehicle: true, driver: true, supervisor: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(requests);
}

// POST /api/service-requests  (Workflow A)
// Driver submits a request; we immediately alert Slack + email manager/supervisor.
export async function POST(req) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { vehicleId, issue, priority } = body;

  if (!vehicleId || !issue?.trim()) {
    return NextResponse.json(
      { error: "vehicleId and issue are required" },
      { status: 400 }
    );
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  // Pick a supervisor to attach (first active one). Adjust to your org's mapping.
  const supervisor = await prisma.user.findFirst({
    where: { role: "SUPERVISOR", active: true },
  });

  const request = await prisma.serviceRequest.create({
    data: {
      vehicleId,
      driverId: session.user.id,
      supervisorId: supervisor?.id || null,
      issue: issue.trim(),
      priority: priority || "normal",
      status: "PENDING",
    },
    include: { vehicle: true, driver: true, supervisor: true },
  });

  // --- Notifications (fire-and-forget; never block on a failed integration) ---
  const label = `${request.vehicle.licensePlate} | ${request.driver.name} | ${request.issue} | Status: Pending Schedule`;

  await sendSlackChannelAlert(
    `:rotating_light: New service request — ${label}`,
    slackFields("New Service Request", [
      { label: "Vehicle", value: `${request.vehicle.unitNumber || ""} ${request.vehicle.licensePlate}`.trim() },
      { label: "Driver", value: request.driver.name },
      { label: "Issue", value: request.issue },
      { label: "Priority", value: request.priority },
      { label: "Status", value: "Pending Schedule" },
    ])
  );

  // Email the fleet manager(s) and the assigned supervisor.
  const managers = await prisma.user.findMany({
    where: { role: "MANAGER", active: true },
    select: { email: true },
  });
  const recipients = [
    ...managers.map((m) => m.email),
    request.supervisor?.email,
  ].filter(Boolean);

  await sendEmail({
    to: recipients,
    subject: `New service request — ${request.vehicle.licensePlate}`,
    html: emailLayout("New Service Request", `
      <p><strong>Vehicle:</strong> ${request.vehicle.unitNumber || ""} (${request.vehicle.licensePlate})</p>
      <p><strong>Driver:</strong> ${request.driver.name}</p>
      <p><strong>Issue:</strong> ${request.issue}</p>
      <p><strong>Priority:</strong> ${request.priority}</p>
      <p><strong>Status:</strong> Pending Schedule</p>
    `),
  });

  // Keep the admin sheet in sync (non-blocking).
  syncToSheets().catch(() => {});

  return NextResponse.json(request, { status: 201 });
}
