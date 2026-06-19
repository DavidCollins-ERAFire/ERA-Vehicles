"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STEPS = ["Mileage", "Documents", "Equipment", "Issues"];

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-burgundy-100 px-4 py-3">
      <span className="text-sm font-medium text-burgundy-900">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded-md px-3 py-1 text-sm font-medium ${value === true ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-md px-3 py-1 text-sm font-medium ${value === false ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"}`}
        >
          No
        </button>
      </div>
    </div>
  );
}

export function QuarterlyForm({ vehicle, period }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    reportedMileage: vehicle.currentMileage || "",
    insuranceCardPresent: null,
    registrationValid: null,
    wexCardId: vehicle.wexCardId || "",
    turnpikeTransponder: vehicle.turnpikeTransponder || "",
    hiddenIssues: "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function canAdvance() {
    if (step === 0) return String(form.reportedMileage).trim() !== "";
    if (step === 1) return form.insuranceCardPresent !== null && form.registrationValid !== null;
    return true;
  }

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/quarterly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: vehicle.id, ...form }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submit failed");
      }
      setDone(true);
      setTimeout(() => router.push("/driver"), 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
          <p className="text-lg font-semibold text-burgundy-900">Review submitted</p>
          <p className="text-sm text-muted-foreground">
            Thanks — your {period} review is recorded. Redirecting…
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Quarterly review · {period}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {vehicle.unitNumber ? `${vehicle.unitNumber} · ` : ""}{vehicle.licensePlate}
        </p>
        {/* Step indicator */}
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-burgundy-700" : "bg-burgundy-100"}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs font-medium text-burgundy-700">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {step === 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="mileage">Current odometer reading</Label>
            <Input
              id="mileage"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 84210"
              value={form.reportedMileage}
              onChange={(e) => set("reportedMileage", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Read it straight off the dash.</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <Toggle
              label="Physical insurance card in the glovebox?"
              value={form.insuranceCardPresent}
              onChange={(v) => set("insuranceCardPresent", v)}
            />
            <Toggle
              label="Registration present and not expired?"
              value={form.registrationValid}
              onChange={(v) => set("registrationValid", v)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wex">WEX fuel card ID</Label>
              <Input id="wex" value={form.wexCardId} onChange={(e) => set("wexCardId", e.target.value)} placeholder="Last digits / card ID" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transponder">Turnpike transponder ID</Label>
              <Input id="transponder" value={form.turnpikeTransponder} onChange={(e) => set("turnpikeTransponder", e.target.value)} placeholder="E-ZPass / transponder number" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-1.5">
            <Label htmlFor="issues">Any hidden or developing maintenance issues?</Label>
            <Textarea
              id="issues"
              placeholder="Anything not obvious — slow leaks, intermittent lights, worn tires, pulling, vibration…"
              value={form.hiddenIssues}
              onChange={(e) => set("hiddenIssues", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Optional, but the more detail the better.</p>
          </div>
        )}

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button variant="default" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="gold" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit review"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
