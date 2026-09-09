"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "./admin.module.css";

/**
 * Branded error boundary for the admin area. Whatever goes wrong inside a
 * page, the person sees a plain explanation and a way back — never a stack
 * trace. The detail is logged to the console for whoever is investigating.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] page error:", error);
  }, [error]);

  return (
    <div className={styles.page}>
      <span className={styles.eyebrowLocal}>Email tracking</span>
      <div className={styles.errorBanner}>
        <h2>Something went wrong loading this page</h2>
        <p>
          The tracking endpoints are unaffected — opens and clicks are still being
          recorded. This is a display problem, not a data problem.
        </p>
        <p>
          Try again, or go back to the dashboard. If it keeps happening, tell
          Michael and quote the reference below.
        </p>
        <p style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button type="button" className={styles.buttonPrimary} onClick={reset}>
            Try again
          </button>
          <Link href="/admin" className={styles.buttonSecondary}>
            Back to the dashboard
          </Link>
        </p>
        {error.digest && (
          <pre className={styles.errorDetail}>reference: {error.digest}</pre>
        )}
      </div>
    </div>
  );
}
