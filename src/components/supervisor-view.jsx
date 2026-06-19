"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, Flag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/utils";

const LOGISTICS_LABEL = {
  RIDING_WITH: "Riding with",
  SPARE_VEHICLE: "Spare vehicle",
  OFFICE_DUTY: "Office duty",
};

// Inline panel to raise a scheduling conflict on one request (Workflow B).
function FlagPanel({ request, onDone }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/service-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "flag-conflict",
          conflictNote: note.trim() || "Scheduling conflict flagged.",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-red-100 bg-red-50/50 p-4">
      <div className="space-y-1.5">
        <Label>What&apos;s the conflict?</Label>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Driver is covering Route 4 that morning — please move to the afternoon."
        />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={submit} disabled={busy}>
          {busy ? "Sending…" : "Send conflict flag"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function SupervisorView({ requests, isManager }) {
  const router = useRouter();
  const [openFlag, setOpenFlag] = useState(null);

  const refresh = () => {
    setOpenFlag(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-burgundy-900">Supervisor view</h1>
        <p className="text-sm text-muted-foreground">
          {isManager
            ? "All scheduled service across the fleet. Flag anything that clashes with operations."
            : "Scheduled service for your drivers. Flag anything that clashes with operations."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-5 w-5 text-blue-600" /> Scheduled service
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing scheduled right now.
            </p>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => {
                const logisticsText = r.logistics
                  ? `${LOGISTICS_LABEL[r.logistics]}${
                      r.logisticsDetail ? `: ${r.logisticsDetail}` : ""
                    }`
                  : "—";
                return (
                  <div
                    key={r.id}
                    className="rounded-md border border-burgundy-100 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-burgundy-900">
                          {r.vehicle.licensePlate} · {r.issue}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.serviceShop || "Shop TBD"} @{" "}
                          {formatDateTime(r.scheduledFor)} · {r.driver.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Logistics: {logisticsText}
                        </p>
                        {r.conflictFlag && (
                          <p className="mt-2 inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                            <AlertTriangle className="h-3 w-3" /> Conflict raised:{" "}
                            {r.conflictNote}
                          </p>
                        )}
                      </div>
                      {r.conflictFlag ? (
                        <Badge variant="danger">
                          <Flag className="mr-1 h-3 w-3" /> Flagged
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setOpenFlag(openFlag === r.id ? null : r.id)
                          }
                        >
                          <AlertTriangle className="h-4 w-4" /> Flag conflict
                        </Button>
                      )}
                    </div>
                    {openFlag === r.id && (
                      <FlagPanel request={r} onDone={refresh} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        Flagging a conflict alerts the fleet manager by Slack and email
        immediately.
      </p>
    </div>
  );
}
