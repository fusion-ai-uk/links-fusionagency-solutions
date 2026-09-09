import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  can,
  findUserByEmail,
  type AppUser,
  type Capability,
} from "@/config/users";

export const ADMIN_SESSION_COOKIE = "admin_session";

/** Bumped when the cookie format changes, which invalidates old sessions. */
const SESSION_VERSION = "admin-session-v2";

/** Constant-time comparison that does not leak the length of either input. */
function digestsMatch(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function getPassword(user: AppUser): string | null {
  return process.env[user.passwordEnv] || null;
}

/**
 * Session token for a user, derived from their own password. Changing a
 * password therefore signs that user out everywhere, which is what we want.
 */
function getSessionToken(user: AppUser): string | null {
  const password = getPassword(user);
  if (!password) return null;
  return createHmac("sha256", password)
    .update(`${SESSION_VERSION}:${user.email}`)
    .digest("hex");
}

export function verifyCredentials(
  email: string,
  password: string
): AppUser | null {
  const user = findUserByEmail(email);
  if (!user) return null;

  const expected = getPassword(user);
  if (!expected) return null;

  return digestsMatch(password, expected) ? user : null;
}

/** Cookie value: the email, then the token, so we know who is signed in. */
export function getSessionCookieValue(user: AppUser): string | null {
  const token = getSessionToken(user);
  if (!token) return null;
  return `${encodeURIComponent(user.email)}.${token}`;
}

function parseSession(value: string | undefined): AppUser | null {
  if (!value) return null;

  const separator = value.lastIndexOf(".");
  if (separator === -1) return null;

  const email = decodeURIComponent(value.slice(0, separator));
  const token = value.slice(separator + 1);

  const user = findUserByEmail(email);
  if (!user) return null;

  const expected = getSessionToken(user);
  if (!expected) return null;

  try {
    return digestsMatch(token, expected) ? user : null;
  } catch {
    return null;
  }
}

/** The signed-in user, or null. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  return parseSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

/** The signed-in user, resolved from a Request (for route handlers). */
export function getUserFromRequest(request: Request): AppUser | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ADMIN_SESSION_COOKIE}=([^;]+)`)
  );
  if (!match?.[1]) return null;

  try {
    return parseSession(decodeURIComponent(match[1]));
  } catch {
    return parseSession(match[1]);
  }
}

/** True when the request comes from a signed-in user holding this capability. */
export function requestHasCapability(
  request: Request,
  capability: Capability
): boolean {
  const user = getUserFromRequest(request);
  return user !== null && can(user.role, capability);
}

export function unauthorizedResponse(): Response {
  return new Response("Unauthorized", { status: 401 });
}

export function forbiddenResponse(message: string): Response {
  return new Response(message, { status: 403 });
}
