# ERA Fleet Management

A lightweight, self-hosted fleet management web app for ERA — built to run on a
Raspberry Pi or a low-spec Mini PC. Drivers request service from their phones,
fleet managers schedule and invoice the work, supervisors flag conflicts, and
the system sends predictive-maintenance reminders on its own.

Everything lives in **one Next.js project** with a **local SQLite database** —
no separate database server to run, no cloud bill.

---

## What it does

- **Service requests (Workflow A)** — a driver signs in with Google, sees their
  assigned vehicle (or a temporary spare), and submits an issue. That instantly
  posts to a Slack channel and emails the manager + supervisor.
- **Scheduling & logistics (Workflow B)** — the manager assigns a shop, a
  date/time, and driver logistics (riding with someone / spare vehicle / office
  duty). Saving DMs and emails the driver and supervisor. Supervisors can flag a
  scheduling conflict, which alerts the manager.
- **Invoicing (Workflow C)** — when work is done, the manager marks it complete,
  enters an interim cost, and uploads the receipt/PDF, which goes straight to a
  Google Drive folder (nothing stored on the Pi).
- **Predictive maintenance (Workflow D)** — a daily sweep warns 30 days before
  registration / inspection / emissions / insurance expiry, nudges for the
  quarterly review each quarter, and projects synthetic-oil life (4k–6k mi) to
  warn the driver as the interval approaches.
- **Quarterly review (Workflow E)** — a mobile, multi-step form to log mileage,
  confirm the insurance card and registration, capture the WEX card and Turnpike
  transponder IDs, and flag any hidden issues. It updates the vehicle record.

Everything also mirrors into a Google Sheet (Vehicles + Service Requests tabs)
for easy manual viewing.

---

## Tech stack

Next.js 14 (App Router) · React 18 · Prisma + SQLite · NextAuth (Google OAuth) ·
googleapis (Drive/Sheets/Gmail) · @slack/web-api + Incoming Webhooks ·
Tailwind CSS (Burgundy `#800020` / Gold `#FFD700` theme) · Lucide icons.

---

## Quick start

### Option A — automated (Raspberry Pi / Debian / Ubuntu)

```bash
cd era-fleet
./setup.sh            # add --seed to also load demo data
```

The script updates the system, installs Node 18, installs dependencies, creates
`.env` (auto-generating the two required secrets), creates the database, builds
the app, and starts it under PM2. When it finishes it prints the URL and the
exact commands for reboot-persistence and the cron sweep.

You still need to paste your Google and Slack credentials into `.env` (see
[Credentials](#credentials-the-unavoidable-part) below) and then
`pm2 restart era-fleet`.

### Option B — manual / development (any OS with Node 18+)

```bash
cd era-fleet
npm install
cp .env.example .env          # then edit .env (at minimum set NEXTAUTH_SECRET)
npx prisma generate
npx prisma db push
npm run db:seed               # optional demo data
npm run dev                   # http://localhost:3000
```

> The app **boots and runs before any Google/Slack setup** — those integrations
> simply do nothing until configured. So you can click around locally first,
> then wire up credentials.

---

## Credentials (the unavoidable part)

There is no way around this: any app that signs people in with Google and writes
to Drive/Sheets/Gmail/Slack needs accounts and keys created in those consoles.
The code is done — this is configuration, done once. Put every value below into
`.env` (template + notes are in `.env.example`).

### 1. Google OAuth (sign-in)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create a
   project (e.g. "ERA Fleet").
2. **APIs & Services → OAuth consent screen** → Internal (or External) → fill in
   the basics.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** →
   *Web application*. Add an Authorized redirect URI:
   ```
   <NEXTAUTH_URL>/api/auth/callback/google
   # dev example:  http://localhost:3000/api/auth/callback/google
   ```
4. Copy the Client ID/Secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. Set `ALLOWED_EMAIL_DOMAINS` (e.g. `erafire.com`) so only company accounts can
   sign in.

### 2. Enable the Google APIs

In **APIs & Services → Library**, enable: **Google Drive API**,
**Google Sheets API**, and **Gmail API**.

### 3. Service account (Drive / Sheets / Gmail send)

The background jobs (and uploads) act without a logged-in user, so they use a
service account.

1. **IAM & Admin → Service Accounts → Create** → create a JSON key and download
   it.
2. Put it in `.env` one of two ways: base64 the file into
   `GOOGLE_SERVICE_ACCOUNT_KEY` (`base64 -w0 key.json`), **or** set
   `GOOGLE_SERVICE_ACCOUNT_FILE` to its path.
3. **Drive folder:** create the invoices folder, copy its ID from the URL into
   `GOOGLE_DRIVE_INVOICE_FOLDER_ID`, and **share the folder** with the service
   account's email (`…@….iam.gserviceaccount.com`) as Editor.
4. **Sheet:** create a spreadsheet, copy its ID into `GOOGLE_SHEETS_ID`, and
   **share it** with the service account as Editor.
5. **Gmail send:** set `GMAIL_SENDER` to the from-address. Gmail sending requires
   **domain-wide delegation** for the service account, authorized in Google
   Workspace Admin for the `gmail.send` scope. (If you skip this, everything else
   works; system emails just won't send — Slack still will.)

### 4. Slack

1. Create an app at [api.slack.com/apps](https://api.slack.com/apps) (From
   scratch) in your workspace.
2. **Incoming Webhooks** → enable → Add New Webhook → pick the alerts channel →
   copy the URL into `SLACK_WEBHOOK_URL`.
3. **OAuth & Permissions** → add bot scopes `chat:write`, `im:write`,
   `users:read` → install to workspace → copy the **Bot User OAuth Token**
   (`xoxb-…`) into `SLACK_BOT_TOKEN`.
4. For direct messages to reach a person, put their Slack member ID in their
   `slackId` (User table, via Prisma Studio). Channel webhook alerts work without
   this.

---

## Roles & first login

- The **first person to sign in** on a fresh (unseeded) database becomes
  **MANAGER** automatically. Everyone after defaults to **DRIVER**.
- If you ran `--seed` / `npm run db:seed`, the table already has demo users, so
  that shortcut won't apply — instead promote yourself:
  ```bash
  npm run db:studio        # opens a local DB editor in the browser
  ```
  Open the **User** table, set your `role` to `MANAGER` (or `SUPERVISOR`), save.
- Assign a vehicle to a driver in Prisma Studio by setting the vehicle's
  `assignedDriverId`. Set a request's `supervisorId` to control who gets
  conflict-flag alerts for it.

---

## Running in production

`setup.sh` already starts the app under PM2. Manually, the equivalent is:

```bash
npm run build
pm2 start npm --name era-fleet -- start
pm2 save
pm2 startup        # prints a command to run (with sudo) for reboot persistence
```

Handy commands: `pm2 logs era-fleet`, `pm2 restart era-fleet`,
`pm2 status`.

### Daily maintenance sweep

The reminder logic lives behind a secret-protected endpoint. Schedule the runner
with cron (`crontab -e`):

```cron
0 7 * * * cd /home/pi/era-fleet && /usr/bin/node scripts/run-maintenance.js >> /home/pi/era-fleet/cron.log 2>&1
```

`npm run cron:maintenance` does the same thing on demand. It reads `.env`
automatically and calls the running app, so the app must be up.

---

## Project structure

```
era-fleet/
├── package.json
├── setup.sh                     # automated Pi installer (PM2)
├── .env.example                 # copy to .env and fill in
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json                # @/* path alias → src/*
├── prisma/
│   ├── schema.prisma            # full data model (SQLite)
│   └── seed.js                  # demo users / vehicles / requests
├── scripts/
│   └── run-maintenance.js       # cron runner for the reminder sweep
└── src/
    ├── middleware.js            # protects all routes except login + auth + cron
    ├── lib/
    │   ├── prisma.js            # Prisma client singleton
    │   ├── auth.js              # NextAuth config, role helpers, domain lock
    │   ├── google.js            # service-account auth loader
    │   ├── drive.js             # invoice upload → Drive
    │   ├── sheets.js            # DB → Google Sheets mirror
    │   ├── gmail.js             # branded system emails
    │   ├── slack.js             # channel webhook + bot DMs
    │   ├── maintenance.js       # alert math + idempotent sweep (Workflow D)
    │   └── utils.js             # formatting + date/period helpers
    ├── components/
    │   ├── ui/                  # button, card, input, select, badge, …
    │   ├── header.jsx           # role-aware nav
    │   ├── app-shell.jsx
    │   ├── providers.jsx
    │   ├── request-form.jsx     # Workflow A
    │   ├── quarterly-form.jsx   # Workflow E (multi-step)
    │   ├── manager-dashboard.jsx# Workflows B + C
    │   └── supervisor-view.jsx  # conflict flagging
    └── app/
        ├── layout.js  globals.css  page.js   # root + role router
        ├── login/page.js
        ├── driver/         (page, request, quarterly)
        ├── manager/page.js
        ├── supervisor/page.js
        └── api/
            ├── auth/[...nextauth]/route.js
            ├── service-requests/route.js          # list + create (A)
            ├── service-requests/[id]/route.js      # schedule/complete/flag (B,C)
            ├── vehicles/route.js
            ├── quarterly/route.js                  # (E)
            └── cron/maintenance/route.js           # (D), secret-protected
```

---

## Honest notes on scope

This is a complete, runnable foundation. A few things are deliberately
assumption-based and worth tuning against your real environment:

- **Oil-life is projected, not measured.** With no live odometer feed, the sweep
  estimates miles-since-service from the last reading using
  `FLEET_AVG_MILES_PER_DAY`. The quarterly form updates the true mileage. Tune
  that value to your fleet, or update mileage more often for tighter estimates.
- **Supervisor → driver mapping is per-request.** A request's `supervisorId`
  decides who gets its conflict/schedule alerts. The seed wires this up; in real
  use set it when creating requests, or extend the schema to map supervisors to
  drivers/teams if you want it automatic.
- **Email needs domain-wide delegation** to actually send via Gmail (see above).
  Slack works with just a webhook + token. Until both are set, those steps no-op
  gracefully so nothing crashes.
- **Real-world testing of the integrations** (OAuth consent, Drive permissions,
  Slack scopes) can only be finalized in your Google Workspace and Slack
  workspace — the code paths are in place and fail safe when unconfigured.

---

## Troubleshooting

- **Can't sign in / "Access denied":** the account's domain isn't in
  `ALLOWED_EMAIL_DOMAINS`, or the redirect URI in Google doesn't exactly match
  `<NEXTAUTH_URL>/api/auth/callback/google`.
- **Uploads/sheets/email do nothing:** the service account JSON isn't set, or the
  Drive folder / Sheet isn't shared with the service account email.
- **Slack DMs don't arrive but channel posts do:** the user's `slackId` is empty,
  or the bot is missing `im:write` / `users:read`.
- **Cron sweep says it can't connect:** the app isn't running, or
  `CRON_TARGET_URL`/`NEXTAUTH_URL` doesn't point at the local server.
- **Reset the database (dev only):** delete `prisma/database.sqlite` and re-run
  `npx prisma db push` (and `npm run db:seed` if you want demo data).
