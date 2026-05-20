import { createHmac } from "crypto";

/**
 * Hash a client IP with HMAC-SHA256 so raw IPs are never stored.
 * Returns null when IP or secret is unavailable.
 */
export function hashIp(ip: string | null | undefined): string | null {
  const secret = process.env.IP_HASH_SECRET;
  if (!ip || !secret) return null;

  return createHmac("sha256", secret).update(ip.trim()).digest("hex");
}

/** Extract client IP from Vercel / proxy headers. */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return null;
}
