import { PrismaClient } from "@prisma/client";

// Reuse a single Prisma client across the app (and across hot reloads in dev)
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production" ? ["warn", "error"] : ["query", "warn", "error"],
});
