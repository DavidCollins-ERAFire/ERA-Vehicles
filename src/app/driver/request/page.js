import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { RequestForm } from "@/components/request-form";

export const dynamic = "force-dynamic";

export default async function RequestPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // A driver can request service for their assigned vehicle or any spare.
  const assigned = await prisma.vehicle.findFirst({
    where: { assignedDriverId: session.user.id },
  });
  const spares = await prisma.vehicle.findMany({
    where: { isSpare: true, active: true },
  });

  const vehicles = [assigned, ...spares].filter(Boolean);

  return (
    <AppShell>
      {vehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No vehicle is available to you yet. Contact your fleet manager.
        </p>
      ) : (
        <RequestForm vehicles={vehicles} defaultVehicleId={assigned?.id} />
      )}
    </AppShell>
  );
}
