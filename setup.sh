#!/usr/bin/env bash
# ===========================================================================
# ERA Fleet — automated setup for Linux / Raspberry Pi
# ===========================================================================
# What this does:
#   1. Updates apt and installs prerequisites (curl, openssl, git)
#   2. Installs Node.js 18 LTS (only if a suitable version isn't present)
#   3. Installs npm dependencies
#   4. Creates .env from the template and auto-generates the two secrets
#   5. Generates the Prisma client and creates the SQLite database
#   6. (optional) Seeds demo data   →  run with:  ./setup.sh --seed
#   7. Builds the app and launches it under PM2 so it survives reboots
#
# Re-running is safe. After it finishes, open the printed URL in a browser.
# ===========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SEED=0
for arg in "$@"; do
  [ "$arg" = "--seed" ] && SEED=1
done

say() { printf "\n\033[1;35m==>\033[0m \033[1m%s\033[0m\n" "$1"; }
note() { printf "    %s\n" "$1"; }

# --- 1. System packages ----------------------------------------------------
if command -v apt-get >/dev/null 2>&1; then
  say "Updating system packages"
  sudo apt-get update -y
  sudo apt-get install -y curl ca-certificates openssl git
else
  note "apt-get not found — skipping system package step (non-Debian system)."
  note "Make sure curl, openssl and git are installed."
fi

# --- 2. Node.js 18+ ---------------------------------------------------------
need_node=1
if command -v node >/dev/null 2>&1; then
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$major" -ge 18 ] 2>/dev/null; then
    need_node=0
    say "Node.js $(node -v) already installed"
  fi
fi
if [ "$need_node" -eq 1 ]; then
  if command -v apt-get >/dev/null 2>&1; then
    say "Installing Node.js 18 LTS"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    note "Please install Node.js 18+ manually, then re-run this script."
    exit 1
  fi
fi

# --- 3. Dependencies --------------------------------------------------------
say "Installing npm dependencies (this can take a few minutes on a Pi)"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

# --- 4. Environment file ----------------------------------------------------
if [ ! -f .env ]; then
  say "Creating .env from template"
  cp .env.example .env

  # Auto-generate the two required secrets so the app boots immediately.
  SECRET="$(openssl rand -base64 32)"
  CRON="$(openssl rand -hex 16)"
  # Use a non-/ delimiter for sed since base64 can contain slashes.
  sed -i "s|paste-a-long-random-string-here|${SECRET}|" .env
  sed -i "s|paste-a-random-string-here|${CRON}|" .env
  note "Generated NEXTAUTH_SECRET and CRON_SECRET automatically."
  note "Now edit .env to add Google OAuth, Drive, Sheets, Gmail and Slack values."
else
  say ".env already exists — leaving it untouched"
fi

# --- 5. Database ------------------------------------------------------------
say "Generating Prisma client and creating the SQLite database"
npx prisma generate
npx prisma db push

# --- 6. Optional demo data --------------------------------------------------
if [ "$SEED" -eq 1 ]; then
  say "Seeding demo data"
  npm run db:seed
  note "Remember: set YOUR account's role to MANAGER in 'npm run db:studio'."
fi

# --- 7. Build + PM2 ---------------------------------------------------------
say "Building the production app"
npm run build

if ! command -v pm2 >/dev/null 2>&1; then
  say "Installing PM2 (process manager)"
  sudo npm install -g pm2
fi

say "Starting ERA Fleet under PM2"
# Restart cleanly if it was already running from a previous run.
pm2 delete era-fleet >/dev/null 2>&1 || true
pm2 start npm --name era-fleet -- start
pm2 save

PORT_URL="$(grep -E '^NEXTAUTH_URL=' .env | head -n1 | cut -d= -f2- | tr -d '"' || true)"
[ -z "$PORT_URL" ] && PORT_URL="http://localhost:3000"

say "Done!"
note "ERA Fleet is running at: ${PORT_URL}"
note ""
note "To make PM2 relaunch the app automatically after a reboot, run the"
note "command that the following prints, then 'pm2 save' once more:"
note "    pm2 startup"
note ""
note "To schedule the daily maintenance sweep, add to 'crontab -e':"
note "    0 7 * * * cd ${SCRIPT_DIR} && /usr/bin/node scripts/run-maintenance.js >> ${SCRIPT_DIR}/cron.log 2>&1"
note ""
note "Useful commands:  pm2 logs era-fleet   pm2 restart era-fleet   npm run db:studio"
