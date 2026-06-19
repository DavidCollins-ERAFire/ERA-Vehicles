import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot-reloads in dev. Without this,
// Next.js would spawn a new client (and new SQLite handle) on every reload.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
