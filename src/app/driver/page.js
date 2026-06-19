import Link from "next/link";
import { redirect } from "next/navigation";
import { Wrench, ClipboardCheck, AlertTriangle, Gauge } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeVehicleAlerts } from "@/lib/maintenance";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMiles, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  PENDING: "pending",
  SCHEDULED: "scheduled",
  COMPLETE: "complete",
  CANCELLED: "cancelled",
};

export default async function DriverPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const vehicle = await prisma.vehicle.findFirst({
    where: { assignedDriverId: session.user.id },
  });

  const requests = await prisma.serviceRequest.findMany({
    where: { driverId: session.user.id },
    include: { vehicle: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const alerts = vehicle ? computeVehicleAlerts(vehicle) : [];

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-burgundy-900">
            Welcome, {session.user.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">Your vehicle at a glance.</p>
        </div>
        <Button asChild variant="gold">
          <Link href="/driver/request">
            <Wrench className="h-4 w-4" /> Request service
          </Link>
        </Button>
      </div>

      {!vehicle ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No vehicle is assigned to you yet. Ask your fleet manager to assign one,
            or you may be on a temporary spare.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Vehicle card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-burgundy-700" />
                {vehicle.unitNumber || "Assigned vehicle"} · {vehicle.licensePlate}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <Field label="Make / Model" value={[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"} />
                <Field label="Year" value={vehicle.year || "—"} />
                <Field label="Mileage" value={formatMiles(vehicle.currentMileage)} />
                <Field label="Registration" value={formatDate(vehicle.registrationExpiry)} />
                <Field label="Inspection" value={formatDate(vehicle.inspectionExpiry)} />
                <Field label="Emissions" value={formatDate(vehicle.emissionsExpiry)} />
                <Field label="Insurance" value={formatDate(vehicle.insuranceExpiry)} />
                <Field label="Last oil change" value={vehicle.lastOilChangeMileage ? formatMiles(vehicle.lastOilChangeMileage) : "—"} />
                <Field label="WEX card" value={vehicle.wexCardId || "—"} />
              </dl>
            </CardContent>
          </Card>

          {/* Alerts card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing due. You&apos;re all set.</p>
              ) : (
                alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-md px-3 py-2 text-sm ${a.overdue ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}
                  >
                    {a.message}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent requests */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5 text-burgundy-700" /> Your service requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          ) : (
            <div className="divide-y divide-burgundy-50">
              {requests.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-burgundy-900">{r.issue}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.vehicle.licensePlate} · {formatDate(r.createdAt)}
                      {r.status === "SCHEDULED" && r.scheduledFor
                        ? ` · ${r.serviceShop || "shop"} @ ${formatDateTime(r.scheduledFor)}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-burgundy-900">{value}</dd>
    </div>
  );
}
