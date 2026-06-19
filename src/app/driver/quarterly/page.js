import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentPeriod } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { QuarterlyForm } from "@/components/quarterly-form";

export const dynamic = "force-dynamic";

export default async function QuarterlyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const vehicle = await prisma.vehicle.findFirst({
    where: { assignedDriverId: session.user.id },
  });

  return (
    <AppShell>
      {!vehicle ? (
        <p className="text-sm text-muted-foreground">
          You need an assigned vehicle to complete a quarterly review. Contact your
          fleet manager.
        </p>
      ) : (
        <QuarterlyForm vehicle={vehicle} period={currentPeriod()} />
      )}
    </AppShell>
  );
}
