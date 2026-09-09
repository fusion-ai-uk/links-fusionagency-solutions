import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/config/users";
import { GUIDE_ORDER, HELP, SOURCE_LINE } from "@/config/help";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACCENTS = [
  "var(--accent-orange)",
  "var(--accent-cyan)",
  "var(--accent-teal)",
  "var(--accent-violet)",
];

export default async function GuidePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className={styles.page}>
      <Link href="/admin" className={styles.backLink}>
        ← Back to the dashboard
      </Link>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrowLocal}>Email tracking · guidance</span>
          <h1>How to read these figures</h1>
          <p className={styles.subtitle}>
            What each number counts, what it does not, and where it can mislead.
            Written so the caveats travel with the figure — anything taken from
            this dashboard into a client-facing document needs the same care.
          </p>
        </div>
      </header>

      <div className={styles.notice}>
        <span className={styles.noticeHead}>The short version</span>
        This system counts pixel loads and link clicks. It has{" "}
        <strong>no recipient identifiers</strong>, so it can tell you how much
        activity an email generated, but never who generated it. Opens are
        estimates and can be wrong in both directions. Clicks are dependable.
        Anything labelled <em>approximate unique</em> is a rough
        de-duplication, never a headcount.
      </div>

      <nav className={styles.guideNav} aria-label="Jump to a section">
        {GUIDE_ORDER.map((id) => (
          <a key={id} href={`#${id}`} className={styles.guideNavItem}>
            {HELP[id].label}
          </a>
        ))}
      </nav>

      <div className={styles.guideGrid}>
        {GUIDE_ORDER.map((id, index) => {
          const entry = HELP[id];
          return (
            <section
              key={id}
              id={id}
              className={styles.guideEntry}
              style={{
                ["--item-accent" as string]: ACCENTS[index % ACCENTS.length],
              }}
            >
              <h2>{entry.label}</h2>
              <p className={styles.guideShort}>{entry.short}</p>
              {entry.detail && (
                <ul className={styles.guideDetail}>
                  {entry.detail.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <h2 className={styles.sectionDivider}>Your access</h2>
      <section className={`${styles.panel} ${styles.panelWell}`}>
        <p className={styles.guideShort}>
          You are signed in as <strong>{user.name}</strong> ({user.email}) with
          the <strong>{ROLE_LABELS[user.role]}</strong> role.{" "}
          {ROLE_DESCRIPTIONS[user.role]}
        </p>
        <p className={styles.sourceLine}>
          Accounts are named rather than shared, so activity can be attributed.
          Ask Michael if you need a different level of access.
        </p>
      </section>

      <h2 className={styles.sectionDivider}>Using these figures externally</h2>
      <section className={`${styles.panel} ${styles.panelWell}`}>
        <p className={styles.guideShort}>
          Figures here are working data. Before any of it reaches a client
          report:
        </p>
        <ul className={styles.guideDetail}>
          <li>
            Quote clicks in preference to opens, and label opens as estimated
            wherever they appear.
          </li>
          <li>
            Never present an approximate unique count as a number of people,
            recipients or HCPs.
          </li>
          <li>
            Exclude likely bots for anything client-facing, and say that you
            have.
          </li>
          <li>
            Carry the source line with the figure. A number without one is not
            finished.
          </li>
          <li>
            Client-facing, medical or regulatory material is a draft until the
            relevant reviewer has signed it off.
          </li>
        </ul>
        <p className={styles.sourceLine}>{SOURCE_LINE}</p>
      </section>

      <p className={styles.footerSignature}>
        <strong>FUSION</strong> <span>·</span> email link tracking{" "}
        <span>·</span> <strong>INTERNAL</strong>
      </p>
    </div>
  );
}
