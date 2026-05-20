import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "admin_session";

/** Derive a stable session token from ADMIN_PASSWORD. */
function getSessionToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHmac("sha256", password).update("admin-session-v1").digest("hex");
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;

  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export function getSessionCookieValue(): string | null {
  return getSessionToken();
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const expected = getSessionToken();
  if (!expected) return false;

  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session) return false;

  try {
    const a = Buffer.from(session);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Check admin auth from a Request (for route handlers). */
export function isAdminAuthenticatedFromRequest(request: Request): boolean {
  const expected = getSessionToken();
  if (!expected) return false;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
  const session = match?.[1];
  if (!session) return false;

  try {
    const decoded = decodeURIComponent(session);
    const a = Buffer.from(decoded);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function unauthorizedResponse(): Response {
  return new Response("Unauthorized", { status: 401 });
}
