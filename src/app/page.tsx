import Link from "next/link";
import { TRACKING_BASE_URL } from "@/config/site";
import styles from "./admin/admin.module.css";

export default function HomePage() {
  return (
    <main className={styles.page} style={{ maxWidth: 780 }}>
      <span className={styles.eyebrowLocal}>Fusion Data &amp; AI</span>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem" }}>
        Email link tracking
      </h1>
      <p className={styles.subtitle}>
        Campaign-level open and click tracking for Fusion client email
        programmes, served from{" "}
        <strong>{TRACKING_BASE_URL.replace("https://", "")}</strong>. There are
        no recipient identifiers in this system.
      </p>

      <h2 className={styles.sectionDivider}>Where to go</h2>

      <div className={styles.guideGrid}>
        <section
          className={styles.guideEntry}
          style={{ ["--item-accent" as string]: "var(--accent-orange)" }}
        >
          <h2>Dashboard</h2>
          <p className={styles.guideShort}>
            Every tracked email by client programme, with the figures and the
            per-email setup packs. Sign-in required.
          </p>
          <Link href="/admin" className={styles.buttonSecondary}>
            Open the dashboard
          </Link>
        </section>

        <section
          className={styles.guideEntry}
          style={{ ["--item-accent" as string]: "var(--accent-cyan)" }}
        >
          <h2>Email HTML patterns</h2>
          <p className={styles.guideShort}>
            The generic pixel and tracked-link patterns. The exact URLs for a
            specific email come from that email&rsquo;s setup pack.
          </p>
          <Link href="/examples" className={styles.buttonSecondary}>
            View the patterns
          </Link>
        </section>

        <section
          className={styles.guideEntry}
          style={{ ["--item-accent" as string]: "var(--accent-teal)" }}
        >
          <h2>Service health</h2>
          <p className={styles.guideShort}>
            Confirms the service is running and the database is reachable.
          </p>
          <a href="/health" className={styles.buttonSecondary}>
            Check health
          </a>
        </section>
      </div>

      <p className={styles.sourceLineBlock} style={{ marginTop: "1.5rem" }}>
        Tracking URLs: <code>/o?cid=CAMPAIGN_ID</code> for the open pixel,{" "}
        <code>/c/LINK_ID?cid=CAMPAIGN_ID</code> for a tracked link.
      </p>

      <p className={styles.footerSignature}>
        <strong>FUSION</strong> <span>·</span> email link tracking{" "}
        <span>·</span> <strong>INTERNAL</strong>
      </p>
    </main>
  );
}
