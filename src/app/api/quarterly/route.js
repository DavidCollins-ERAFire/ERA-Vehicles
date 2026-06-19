import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { currentPeriod } from "@/lib/utils";
import { sendSlackChannelAlert } from "@/lib/slack";
import { syncToSheets } from "@/lib/sheets";

// POST /api/quarterly  (Workflow E)
// Driver logs mileage, verifies insurance/registration/equipment, flags issues.
// Submitting also updates the vehicle's current mileage + equipment IDs so the
// predictive engine has fresh data to work from.
export async function POST(req) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    vehicleId,
    reportedMileage,
    insuranceCardPresent,
    registrationValid,
    wexCardId,
    turnpikeTransponder,
    hiddenIssues,
  } = body;

  if (!vehicleId || reportedMileage == null) {
    return NextResponse.json(
      { error: "vehicleId and reportedMileage are required" },
      { status: 400 }
    );
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  const period = currentPeriod();

  const report = await prisma.quarterlyReport.create({
    data: {
      vehicleId,
      driverId: session.user.id,
      reportedMileage: parseInt(reportedMileage),
      insuranceCardPresent: Boolean(insuranceCardPresent),
      registrationValid: Boolean(registrationValid),
      wexCardId: wexCardId || null,
      turnpikeTransponder: turnpikeTransponder || null,
      hiddenIssues: hiddenIssues?.trim() || null,
      period,
    },
    include: { vehicle: true, driver: true },
  });

  // Push the verified data back onto the vehicle record.
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      currentMileage: parseInt(reportedMileage),
      mileageAsOf: new Date(),
      wexCardId: wexCardId || vehicle.wexCardId,
      turnpikeTransponder: turnpikeTransponder || vehicle.turnpikeTransponder,
    },
  });

  // If the driver flagged hidden issues or missing docs, alert the channel.
  const problems = [];
  if (!insuranceCardPresent) problems.push("insurance card missing");
  if (!registrationValid) problems.push("registration not valid");
  if (hiddenIssues?.trim()) problems.push(`issues noted: ${hiddenIssues.trim()}`);

  if (problems.length) {
    await sendSlackChannelAlert(
      `:clipboard: Quarterly review flag — *${report.vehicle.licensePlate}* (${report.driver.name}): ${problems.join("; ")}.`
    );
  }

  syncToSheets().catch(() => {});
  return NextResponse.json(report, { status: 201 });
}

// GET /api/quarterly — managers/supervisors review the current period's reports.
export async function GET(req) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || currentPeriod();

  const reports = await prisma.quarterlyReport.findMany({
    where: { period },
    include: { vehicle: true, driver: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reports);
}
