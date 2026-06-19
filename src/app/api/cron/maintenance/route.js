import { NextResponse } from "next/server";
import { runMaintenanceSweep } from "@/lib/maintenance";
import { syncToSheets } from "@/lib/sheets";

// GET/POST /api/cron/maintenance
// Protected by a shared secret rather than a user session so a cron job / PM2
// timer can call it. Pass the secret as ?key=... or an Authorization: Bearer header.
//
// Example crontab (daily at 7am):
//   0 7 * * * curl -s "http://localhost:3000/api/cron/maintenance?key=$CRON_SECRET" >/dev/null

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // must be configured to enable the endpoint
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const header = req.headers.get("authorization");
  return key === secret || header === `Bearer ${secret}`;
}

async function run(req) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await runMaintenanceSweep();
  await syncToSheets().catch(() => {});
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req) {
  return run(req);
}

export async function POST(req) {
  return run(req);
}
