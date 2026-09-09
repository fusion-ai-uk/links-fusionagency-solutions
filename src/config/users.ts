/**
 * Who can sign in, and what they can do.
 *
 * Passwords are never stored here — each user names an environment variable
 * that holds theirs. Add the variable in Vercel (Settings → Environment
 * Variables) and redeploy. A user whose variable is unset simply cannot sign
 * in; nothing else breaks.
 */

export type Role = "admin" | "build";

export interface AppUser {
  /** Lower-case email address, used as the sign-in name. */
  email: string;
  name: string;
  role: Role;
  /** Environment variable holding this user's password. */
  passwordEnv: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  build: "Email build",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin:
    "Full access, including the CSV export of individual events and the debug endpoint.",
  build:
    "Can see every programme, every figure and every setup pack, and can run tests. Cannot download the raw event export.",
};

export const USERS: AppUser[] = [
  {
    email: "michael@fusionagency.solutions",
    name: "Michael",
    role: "admin",
    passwordEnv: "ADMIN_PASSWORD",
  },
  {
    // To give Steven the raw CSV export too, change this role to "admin".
    email: "steven@fusionagency.solutions",
    name: "Steven",
    role: "build",
    passwordEnv: "STEVEN_PASSWORD",
  },
];

export function findUserByEmail(email: string): AppUser | null {
  const normalised = email.trim().toLowerCase();
  return USERS.find((user) => user.email === normalised) ?? null;
}

/** Capabilities are derived from the role, never stored per user. */
export type Capability = "exportCsv" | "viewDebugEndpoint";

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  admin: ["exportCsv", "viewDebugEndpoint"],
  build: [],
};

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}
