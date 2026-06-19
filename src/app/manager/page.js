import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeVehicleAlerts } from "@/lib/maintenance";
import { AppShell } from "@/components/app-shell";
import { ManagerDashboard } from "@/components/manager-dashboard";

export const dynamic = "force-dynamic";

export default async function ManagerPage() {
  const session = await requireRole("MANAGER");
  if (!session) redirect("/login");

  // Pull the four request buckets + fleet + drivers in parallel.
  const [pending, scheduled, completed, vehicles, drivers] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { status: "PENDING" },
      include: { vehicle: true, driver: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.serviceRequest.findMany({
      where: { status: "SCHEDULED" },
      include: { vehicle: true, driver: true, supervisor: true },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.serviceRequest.findMany({
      where: { status: "COMPLETE" },
      include: { vehicle: true },
      orderBy: { completedAt: "desc" },
      take: 12,
    }),
    prisma.vehicle.findMany({
      where: { active: true },
      include: { assignedDriver: true },
      orderBy: [{ unitNumber: "asc" }, { licensePlate: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "DRIVER", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Pre-compute due/overdue items per vehicle so the dashboard can badge them.
  const fleetAlerts = {};
  for (const v of vehicles) {
    fleetAlerts[v.id] = computeVehicleAlerts(v);
  }

  return (
    <AppShell>
      <ManagerDashboard
        pending={pending}
        scheduled={scheduled}
        completed={completed}
        vehicles={vehicles}
        drivers={drivers}
        fleetAlerts={fleetAlerts}
      />
    </AppShell>
  );
}
