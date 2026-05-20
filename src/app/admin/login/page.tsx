import Link from "next/link";
import { loginAction } from "../actions";
import styles from "../admin.module.css";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <h1>Admin login</h1>
        <p>Email tracking dashboard for Fusion Agency Solutions</p>

        {error === "1" && (
          <p className={styles.error} role="alert">
            Incorrect password. Please try again.
          </p>
        )}
        {error === "config" && (
          <p className={styles.error} role="alert">
            ADMIN_PASSWORD is not configured on the server.
          </p>
        )}

        <form action={loginAction} className={styles.loginForm}>
          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className={styles.buttonPrimary}>
            Sign in
          </button>
        </form>

        <p style={{ marginTop: "1.5rem", fontSize: "0.85rem" }}>
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
