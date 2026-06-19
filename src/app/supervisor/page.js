import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { SupervisorView } from "@/components/supervisor-view";

export const dynamic = "force-dynamic";

export default async function SupervisorPage() {
  // Both supervisors and managers can see this view.
  const session = await requireRole(["SUPERVISOR", "MANAGER"]);
  if (!session) redirect("/login");

  const isManager = session.user.role === "MANAGER";

  // Managers see all scheduled work; supervisors see only their drivers'.
  const requests = await prisma.serviceRequest.findMany({
    where: {
      status: "SCHEDULED",
      ...(isManager ? {} : { supervisorId: session.user.id }),
    },
    include: { vehicle: true, driver: true, supervisor: true },
    orderBy: { scheduledFor: "asc" },
  });

  return (
    <AppShell>
      <SupervisorView requests={requests} isManager={isManager} />
    </AppShell>
  );
}
