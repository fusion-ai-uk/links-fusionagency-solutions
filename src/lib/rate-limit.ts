import { prisma } from "@/lib/prisma";
import { getClientIp, hashIp } from "@/lib/ip-hash";

/**
 * Sign-in throttling.
 *
 * Two independent limits, each over a sliding window:
 *   - per email address: a handful of failures, then a pause
 *   - per client address: a looser cap, against someone cycling addresses
 *
 * Attempts are stored in the database so the limit holds across serverless
 * instances. Nothing here reveals whether an address has an account — the
 * response to a locked-out attempt is the same whoever it is.
 */

export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_MAX_FAILURES_PER_EMAIL = 5;
export const LOGIN_MAX_FAILURES_PER_IP = 20;

export interface LimitVerdict {
  allowed: boolean;
  /** Whole minutes until the oldest counted failure leaves the window. */
  retryAfterMinutes: number;
}

/** Pure decision, so the rule is unit-testable without a database. */
export function evaluateFailures(
  failureTimes: Date[],
  limit: number,
  now: Date = new Date(),
  windowMinutes: number = LOGIN_WINDOW_MINUTES
): LimitVerdict {
  const windowStart = now.getTime() - windowMinutes * 60_000;
  const recent = failureTimes
    .filter((t) => t.getTime() > windowStart)
    .sort((a, b) => a.getTime() - b.getTime());

  if (recent.length < limit) return { allowed: true, retryAfterMinutes: 0 };

  // The limit clears when enough of the oldest failures age out.
  const releaseAt = recent[recent.length - limit].getTime() + windowMinutes * 60_000;
  const minutes = Math.max(1, Math.ceil((releaseAt - now.getTime()) / 60_000));
  return { allowed: false, retryAfterMinutes: minutes };
}

export function loginKeys(email: string, request?: { headers: Headers } | null): string[] {
  const keys = [`email:${email.trim().toLowerCase()}`];
  if (request) {
    const ip = getClientIp(request as Request);
    const hashed = hashIp(ip) ?? (ip ? ip : null);
    if (hashed) keys.push(`ip:${hashed}`);
  }
  return keys;
}

async function recentFailures(key: string, now: Date): Promise<Date[]> {
  const rows = await prisma.loginAttempt.findMany({
    where: {
      key,
      success: false,
      attemptedAt: { gt: new Date(now.getTime() - LOGIN_WINDOW_MINUTES * 60_000) },
    },
    select: { attemptedAt: true },
  });
  return rows.map((r) => r.attemptedAt);
}

/** Is a sign-in attempt for these keys currently allowed? */
export async function checkLoginAllowed(keys: string[]): Promise<LimitVerdict> {
  const now = new Date();
  let worst: LimitVerdict = { allowed: true, retryAfterMinutes: 0 };

  for (const key of keys) {
    const limit = key.startsWith("ip:") ? LOGIN_MAX_FAILURES_PER_IP : LOGIN_MAX_FAILURES_PER_EMAIL;
    const verdict = evaluateFailures(await recentFailures(key, now), limit, now);
    if (!verdict.allowed && verdict.retryAfterMinutes >= worst.retryAfterMinutes) {
      worst = verdict;
    }
  }
  return worst;
}

/**
 * Record the outcome. A success clears the email's failures so a legitimate
 * user who finally gets it right is not still throttled. Old rows are pruned
 * in the same trip.
 */
export async function recordLoginAttempt(keys: string[], success: boolean): Promise<void> {
  const cutoff = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000 * 4);
  try {
    await prisma.$transaction([
      ...keys.map((key) => prisma.loginAttempt.create({ data: { key, success } })),
      ...(success
        ? keys
            .filter((k) => k.startsWith("email:"))
            .map((key) => prisma.loginAttempt.deleteMany({ where: { key, success: false } }))
        : []),
      prisma.loginAttempt.deleteMany({ where: { attemptedAt: { lt: cutoff } } }),
    ]);
  } catch (error) {
    // Throttling must never block a sign-in when the database misbehaves —
    // the password check still stands on its own.
    console.error("[rate-limit] failed to record attempt:", error);
  }
}
