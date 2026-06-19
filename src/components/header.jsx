"use client";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Truck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = {
  DRIVER: [
    { href: "/driver", label: "My Vehicle" },
    { href: "/driver/request", label: "Request Service" },
    { href: "/driver/quarterly", label: "Quarterly Review" },
  ],
  SUPERVISOR: [
    { href: "/supervisor", label: "Supervisor" },
    { href: "/driver/request", label: "Request Service" },
  ],
  MANAGER: [
    { href: "/manager", label: "Dashboard" },
    { href: "/supervisor", label: "Supervisor View" },
  ],
};

export function Header() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const links = NAV[role] || [];

  return (
    <header className="sticky top-0 z-40 border-b border-burgundy-100 bg-burgundy-700 text-white">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-gold-400" />
          <span className="font-bold tracking-wide">
            ERA <span className="text-gold-400">FLEET</span>
          </span>
        </Link>

        <nav className="hidden gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-burgundy-50 hover:bg-burgundy-800"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {session?.user && (
            <span className="hidden text-xs text-burgundy-100 sm:block">
              {session.user.name} · {role}
            </span>
          )}
          <Button
            variant="gold"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-t border-burgundy-800 px-3 py-2 md:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="whitespace-nowrap rounded-md bg-burgundy-800 px-3 py-1.5 text-xs font-medium text-burgundy-50"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
