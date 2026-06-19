"use client";
import { signIn } from "next-auth/react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function LoginInner() {
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <main className="era-backdrop flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-burgundy-200 shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-burgundy-700">
            <Truck className="h-8 w-8 text-gold-400" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-burgundy-900">
              ERA <span className="text-gold-500">Fleet</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with your ERA company Google account.
            </p>
          </div>

          {error === "AccessDenied" && (
            <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              That account isn&apos;t on an approved ERA domain. Use your company
              email.
            </p>
          )}

          <Button
            variant="gold"
            size="lg"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: "/" })}
          >
            Continue with Google
          </Button>

          <p className="text-xs text-muted-foreground">
            Access is limited to approved ERA email domains.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
