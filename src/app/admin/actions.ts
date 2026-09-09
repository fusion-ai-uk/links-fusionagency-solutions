"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  getSessionCookieValue,
  verifyCredentials,
} from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    redirect("/admin/login?error=1");
  }

  const user = verifyCredentials(email, password);
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
