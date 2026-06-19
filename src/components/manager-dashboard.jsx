"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Upload,
  AlertTriangle,
  Truck,
  ListTodo,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMiles,
} from "@/lib/utils";

const STATUS_VARIANT = {
  PENDING: "pending",
  SCHEDULED: "scheduled",
  COMPLETE: "complete",
  CANCELLED: "cancelled",
};

function Stat({ icon: Icon, label, value, tone = "burgundy" }) {
  const tones = {
    burgundy: "bg-burgundy-50 text-burgundy-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-burgundy-900">{value}</p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Inline scheduling panel (Workflow B) --------------------------------
function SchedulePanel({ request, drivers, onDone }) {
  const [shop, setShop] = useState(request.serviceShop || "");
  const [when, setWhen] = useState("");
  const [logistics, setLogistics] = useState("RIDING_WITH");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!shop.trim() || !when) {
      setError("Shop and date/time are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/service-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          serviceShop: shop,
          scheduledFor: when,
          logistics,
          logisticsDetail: logistics === "RIDING_WITH" ? detail : "",
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
    <div className="mt-3 space-y-3 rounded-md border border-burgundy-100 bg-burgundy-50/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Service shop</Label>
          <Input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="e.g. Main St. Garage" />
        </div>
        <div className="space-y-1.5">
          <Label>Date &amp; time</Label>
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Driver logistics</Label>
          <Select value={logistics} onChange={(e) => setLogistics(e.target.value)}>
            <option value="RIDING_WITH">Riding with…</option>
            <option value="SPARE_VEHICLE">Spare vehicle</option>
            <option value="OFFICE_DUTY">Office duty</option>
          </Select>
        </div>
        {logistics === "RIDING_WITH" && (
          <div className="space-y-1.5">
            <Label>Riding with</Label>
            <Select value={detail} onChange={(e) => setDetail(e.target.value)}>
              <option value="">Select person…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </Select>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="gold" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save & notify"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

// --- Inline completion panel (Workflow C) --------------------------------
function CompletePanel({ request, onDone }) {
  const [cost, setCost] = useState(request.estimatedCost ?? "");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    setBusy(true);
    try {
      const fd = new FormData();
      if (cost !== "") fd.append("estimatedCost", cost);
      if (file) fd.append("invoice", file);
      const res = await fetch(`/api/service-requests/${request.id}`, {
        method: "PATCH",
        body: fd,
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
    <div className="mt-3 space-y-3 rounded-md border border-green-100 bg-green-50/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Estimated cost (interim)</Label>
          <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 450.00" />
        </div>
        <div className="space-y-1.5">
          <Label>Receipt / invoice (PDF or photo)</Label>
          <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        <Upload className="mr-1 inline h-3 w-3" />
        Uploads go straight to the ERA Drive invoice folder.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="gold" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Mark complete"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

export function ManagerDashboard({ pending, scheduled, completed, vehicles, drivers, fleetAlerts }) {
  const router = useRouter();
  const [openSchedule, setOpenSchedule] = useState(null);
  const [openComplete, setOpenComplete] = useState(null);

  const refresh = () => {
    setOpenSchedule(null);
    setOpenComplete(null);
    router.refresh();
  };

  const dueSoon = Object.values(fleetAlerts).reduce((n, arr) => n + arr.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-burgundy-900">Fleet dashboard</h1>
        <p className="text-sm text-muted-foreground">Service queue, scheduling, and fleet health.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ListTodo} label="Pending" value={pending.length} tone="amber" />
        <Stat icon={CalendarClock} label="Scheduled" value={scheduled.length} tone="blue" />
        <Stat icon={Truck} label="Vehicles" value={vehicles.length} tone="burgundy" />
        <Stat icon={AlertTriangle} label="Maintenance due" value={dueSoon} tone="red" />
      </div>

      {/* Pending queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-5 w-5 text-amber-600" /> Pending — needs scheduling
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Queue is clear. Nice.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((r) => (
                <div key={r.id} className="rounded-md border border-burgundy-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-burgundy-900">
                        {r.vehicle.licensePlate} · {r.issue}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.driver.name} · {formatDate(r.createdAt)} · priority {r.priority}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setOpenSchedule(openSchedule === r.id ? null : r.id)}>
                      <CalendarClock className="h-4 w-4" /> Schedule
                    </Button>
                  </div>
                  {openSchedule === r.id && (
                    <SchedulePanel request={r} drivers={drivers} onDone={refresh} />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduled */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-5 w-5 text-blue-600" /> Scheduled — in progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled right now.</p>
          ) : (
            <div className="space-y-2">
              {scheduled.map((r) => (
                <div key={r.id} className="rounded-md border border-burgundy-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-burgundy-900">
                        {r.vehicle.licensePlate} · {r.issue}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.serviceShop} @ {formatDateTime(r.scheduledFor)} · {r.driver.name}
                      </p>
                      {r.conflictFlag && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                          <AlertTriangle className="h-3 w-3" /> Conflict: {r.conflictNote}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setOpenComplete(openComplete === r.id ? null : r.id)}>
                      <CheckCircle2 className="h-4 w-4" /> Complete
                    </Button>
                  </div>
                  {openComplete === r.id && <CompletePanel request={r} onDone={refresh} />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fleet table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-5 w-5 text-burgundy-700" /> Fleet
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-burgundy-100 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Unit / Plate</th>
                <th className="py-2 pr-3">Driver</th>
                <th className="py-2 pr-3">Mileage</th>
                <th className="py-2 pr-3">Reg.</th>
                <th className="py-2 pr-3">Insp.</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => {
                const alerts = fleetAlerts[v.id] || [];
                return (
                  <tr key={v.id} className="border-b border-burgundy-50">
                    <td className="py-2 pr-3 font-medium text-burgundy-900">
                      {v.unitNumber ? `${v.unitNumber} · ` : ""}{v.licensePlate}
                    </td>
                    <td className="py-2 pr-3">{v.assignedDriver?.name || <span className="text-muted-foreground">Unassigned</span>}</td>
                    <td className="py-2 pr-3">{formatMiles(v.currentMileage)}</td>
                    <td className="py-2 pr-3">{formatDate(v.registrationExpiry)}</td>
                    <td className="py-2 pr-3">{formatDate(v.inspectionExpiry)}</td>
                    <td className="py-2 pr-3">
                      {alerts.length === 0 ? (
                        <Badge variant="complete">OK</Badge>
                      ) : (
                        <Badge variant="danger">{alerts.length} due</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Recently completed (with invoice links) */}
      {completed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Recently completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-burgundy-50">
              {completed.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {r.vehicle.licensePlate} · {r.issue}
                    <span className="ml-2 text-xs text-muted-foreground">{formatMoney(r.estimatedCost)}</span>
                  </span>
                  {r.invoiceDriveUrl ? (
                    <a href={r.invoiceDriveUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-burgundy-700 underline">
                      View invoice
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">No invoice</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
