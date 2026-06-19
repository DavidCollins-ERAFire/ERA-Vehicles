import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { syncToSheets } from "@/lib/sheets";

// GET /api/vehicles — everyone can read the roster (drivers need it for the form).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vehicles = await prisma.vehicle.findMany({
    where: { active: true },
    include: { assignedDriver: { select: { id: true, name: true } } },
    orderBy: { unitNumber: "asc" },
  });
  return NextResponse.json(vehicles);
}

// POST /api/vehicles — managers add a vehicle.
export async function POST(req) {
  const session = await auth();
  if (session?.user?.role !== "MANAGER") {
    return NextResponse.json({ error: "Managers only" }, { status: 403 });
  }
  const body = await req.json();
  if (!body.licensePlate) {
    return NextResponse.json({ error: "licensePlate required" }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      licensePlate: body.licensePlate,
      unitNumber: body.unitNumber || null,
      make: body.make || null,
      model: body.model || null,
      year: body.year ? parseInt(body.year) : null,
      vin: body.vin || null,
      currentMileage: body.currentMileage ? parseInt(body.currentMileage) : 0,
      lastOilChangeMileage: body.lastOilChangeMileage ? parseInt(body.lastOilChangeMileage) : null,
      lastOilChangeDate: body.lastOilChangeDate ? new Date(body.lastOilChangeDate) : null,
      registrationExpiry: body.registrationExpiry ? new Date(body.registrationExpiry) : null,
      inspectionExpiry: body.inspectionExpiry ? new Date(body.inspectionExpiry) : null,
      emissionsExpiry: body.emissionsExpiry ? new Date(body.emissionsExpiry) : null,
      insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : null,
      wexCardId: body.wexCardId || null,
      turnpikeTransponder: body.turnpikeTransponder || null,
      isSpare: Boolean(body.isSpare),
    },
  });

  syncToSheets().catch(() => {});
  return NextResponse.json(vehicle, { status: 201 });
}

// PATCH /api/vehicles — managers update mileage / oil change / compliance dates.
export async function PATCH(req) {
  const session = await auth();
  if (session?.user?.role !== "MANAGER") {
    return NextResponse.json({ error: "Managers only" }, { status: 403 });
  }
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data = {};
  if (body.currentMileage != null) {
    data.currentMileage = parseInt(body.currentMileage);
    data.mileageAsOf = new Date();
  }
  if (body.lastOilChangeMileage != null) data.lastOilChangeMileage = parseInt(body.lastOilChangeMileage);
  if (body.lastOilChangeDate) data.lastOilChangeDate = new Date(body.lastOilChangeDate);
  if (body.registrationExpiry) data.registrationExpiry = new Date(body.registrationExpiry);
  if (body.inspectionExpiry) data.inspectionExpiry = new Date(body.inspectionExpiry);
  if (body.emissionsExpiry) data.emissionsExpiry = new Date(body.emissionsExpiry);
  if (body.insuranceExpiry) data.insuranceExpiry = new Date(body.insuranceExpiry);
  if (body.assignedDriverId !== undefined) data.assignedDriverId = body.assignedDriverId || null;

  const updated = await prisma.vehicle.update({ where: { id: body.id }, data });
  syncToSheets().catch(() => {});
  return NextResponse.json(updated);
}
