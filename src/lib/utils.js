import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind-aware className combiner used by all UI components.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// --- Shared formatting helpers -------------------------------------------

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

export function formatMiles(value) {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("en-US").format(Number(value))} mi`;
}

// Current fiscal quarter label, e.g. "2026-Q2". Used to group quarterly reports.
export function currentPeriod(date = new Date()) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${q}`;
}

// Days between today and a target date (negative = already past).
export function daysUntil(target) {
  if (!target) return null;
  const ms = new Date(target).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
