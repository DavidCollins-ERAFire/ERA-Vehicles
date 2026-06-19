"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function RequestForm({ vehicles, defaultVehicleId }) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(defaultVehicleId || vehicles[0]?.id || "");
  const [issue, setIssue] = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!vehicleId || !issue.trim()) {
      setError("Pick a vehicle and describe the issue.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, issue, priority }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submit failed");
      }
      setDone(true);
      setTimeout(() => router.push("/driver"), 1400);
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
          <p className="text-lg font-semibold text-burgundy-900">Request submitted</p>
          <p className="text-sm text-muted-foreground">
            Your fleet manager and supervisor have been notified. Redirecting…
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Request vehicle service</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="vehicle">Vehicle</Label>
          <Select id="vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.unitNumber ? `${v.unitNumber} · ` : ""}{v.licensePlate}
                {v.isSpare ? " (spare)" : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="issue">What&apos;s wrong?</Label>
          <Textarea
            id="issue"
            placeholder="Describe the issue — noises, warning lights, leaks, anything you noticed."
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent — vehicle unsafe to drive</option>
          </Select>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button onClick={submit} disabled={submitting} className="w-full" variant="gold" size="lg">
          {submitting ? "Submitting…" : "Submit request"}
        </Button>
      </CardContent>
    </Card>
  );
}
