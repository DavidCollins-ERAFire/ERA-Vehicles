/**
 * ERA Fleet — maintenance sweep runner (for cron / PM2).
 *
 * Run with:  npm run cron:maintenance
 *
 * Rather than re-importing the app's internals, this simply calls the
 * already-built, secret-protected endpoint on the running server. That keeps
 * one source of truth for the logic and avoids any module/bundler mismatch.
 *
 * It reads config from .env / .env.local automatically (no extra deps), so it
 * works the same whether launched by hand, cron, or a PM2 timer.
 *
 * Schedule example (crontab, daily 7am):
 *   0 7 * * * cd /home/pi/era-fleet && /usr/bin/node scripts/run-maintenance.js >> /home/pi/era-fleet/cron.log 2>&1
 */
const fs = require("fs");
const path = require("path");

// --- tiny .env loader (no dependency) ------------------------------------
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

const root = path.resolve(__dirname, "..");
loadEnvFile(path.join(root, ".env")); // base
loadEnvFile(path.join(root, ".env.local")); // overrides if present

async function run() {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "CRON_SECRET is not set. Add it to your .env before running the sweep."
    );
    process.exit(1);
  }

  const base =
    process.env.CRON_TARGET_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  const url = `${base.replace(/\/$/, "")}/api/cron/maintenance?key=${encodeURIComponent(
    secret
  )}`;

  try {
    const res = await fetch(url, { method: "POST" });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Sweep failed (${res.status}): ${text}`);
      process.exit(1);
    }
    console.log(`[${new Date().toISOString()}] Maintenance sweep ok: ${text}`);
  } catch (e) {
    console.error(
      `Could not reach ${base}. Is the app running? (${e.message})`
    );
    process.exit(1);
  }
}

run();
