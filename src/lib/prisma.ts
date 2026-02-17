import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reloads modules on every change, which would
 * normally create a new PrismaClient (and a new database connection pool) each
 * time. To prevent exhausting the database connection limit, we store the client
 * on `globalThis` so it survives hot reloads. In production, module-level state
 * persists for the lifetime of the serverless function, so no special handling
 * is needed.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
