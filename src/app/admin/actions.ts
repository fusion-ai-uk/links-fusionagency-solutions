"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  getSessionCookieValue,
  verifyCredentials,
} from "@/lib/auth";
import { checkLoginAllowed, loginKeys, recordLoginAttempt } from "@/lib/rate-limit";

export async function loginAction(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirect("/admin/login?error=1");
  }

  // Throttle before checking the password, so guessing is slowed whether or
  // not the address exists.
  const requestHeaders = await headers();
  const keys = loginKeys(email, { headers: requestHeaders });
  const limit = await checkLoginAllowed(keys);
  if (!limit.allowed) {
    redirect(`/admin/login?error=locked&mins=${limit.retryAfterMinutes}`);
  }

  const user = verifyCredentials(email, password);
  await recordLoginAttempt(keys, user !== null);

  if (!user) {
    // Deliberately the same message for an unknown address and a wrong
    // password, so the form does not confirm who has an account.
    redirect("/admin/login?error=1");
  }

  const token = getSessionCookieValue(user);
  if (!token) {
    redirect("/admin/login?error=config");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  redirect("/admin");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
