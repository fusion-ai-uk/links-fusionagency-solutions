import Link from "next/link";
import { loginAction } from "../actions";
import styles from "../admin.module.css";

type PageProps = {
  searchParams: Promise<{ error?: string; mins?: string }>;
};

/**
 * The deck's cover uses the fusion_logo.png asset and says it is "never
 * retyped". That asset is not in this repo, so the wordmark is set as type.
 *
 * To use the real logo: add it at public/fusion-logo.png, then swap the
 * <span className={styles.wordmark}> below for
 *   <Image src="/fusion-logo.png" alt="Fusion" width={252} height={73}
 *          className={styles.coverLogo} priority />
 * and import Image from "next/image".
 *
 * Do not detect the file at runtime — public/ is not bundled into Vercel's
 * serverless functions, so an fs check there is always false in production.
 */

/** Fixed wording from the deck. Never edited. */
const TAGLINE = "Deep expertise | Machine speed | Every stage of the lifecycle";

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { error, mins } = await searchParams;
  const lockedMinutes = Math.max(1, Math.min(60, Number(mins) || 1));

  return (
    <div className={styles.loginPage}>
      <div className={styles.cover}>
        <span className={styles.wordmark}>fusion</span>
        <p className={styles.tagline}>{TAGLINE}</p>
        <span className={styles.coverRule} aria-hidden="true" />
      </div>

      <div className={styles.loginCard}>
        <span className={styles.eyebrowLocal}>Email link tracking</span>
        <h1>Sign in</h1>
        <p className={styles.loginIntro}>
          Internal tracking for client email programmes. Access is by named
          account.
        </p>

        {error === "1" && (
          <p className={styles.error} role="alert">
            Those details were not recognised. Check the email address and
            password, and try again.
          </p>
        )}
        {error === "locked" && (
          <p className={styles.error} role="alert">
            Too many sign-in attempts. Try again in about {lockedMinutes}{" "}
            minute{lockedMinutes === 1 ? "" : "s"}.
          </p>
        )}
        {error === "config" && (
          <p className={styles.error} role="alert">
            That account exists but has no password configured on the server.
            Ask Michael to set it in Vercel.
          </p>
        )}

        <form action={loginAction} className={styles.loginForm}>
          <div className={styles.field}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              spellCheck={false}
              placeholder="name@fusionagency.solutions"
            />
          </div>
          <div className={styles.field}>
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

        <p className={styles.loginFooter}>
          <Link href="/">Back to service home</Link>
        </p>
      </div>

      <p className={styles.footerSignature}>
        <strong>FUSION</strong> <span>·</span> internal standard{" "}
        <span>·</span> <strong>EMAIL TRACKING</strong>
      </p>
    </div>
  );
}
