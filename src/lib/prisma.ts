import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Build a Prisma-safe connection string for Neon on Vercel serverless.
 *
 * Vercel's Neon integration provides a pooled URL but WITHOUT the flags Prisma
 * needs to talk to Neon's PgBouncer pooler. Without `pgbouncer=true`, queries
 * stall and you get "Timed out fetching a new connection from the connection
 * pool". We normalise the URL here so it works regardless of how the env var
 * was set.
 */
function buildDatabaseUrl(): string | undefined {
  const raw =
    process.env.DATABASE_POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_POSTGRES_URL;

  if (!raw) return undefined;

  try {
    const url = new URL(raw);

    // Required for Neon's PgBouncer pooler — avoids prepared-statement hangs.
    url.searchParams.set("pgbouncer", "true");
    // Keep a single connection per serverless instance to avoid exhausting the pool.
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    // Give a suspended Neon compute time to wake on the first request.
    url.searchParams.set("connect_timeout", "15");
    // Prisma's engine doesn't need SCRAM channel binding and it can break connects.
    url.searchParams.delete("channel_binding");
    // Ensure TLS.
    if (!url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }

    return url.toString();
  } catch {
    // If it isn't a parseable URL, hand it back untouched.
    return raw;
  }
}

const databaseUrl = buildDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
