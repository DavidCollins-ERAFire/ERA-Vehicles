import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Single entry point — sends each user to the right place for their role.
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  switch (session.user.role) {
    case "MANAGER":
      redirect("/manager");
    case "SUPERVISOR":
      redirect("/supervisor");
    default:
      redirect("/driver");
  }
}
