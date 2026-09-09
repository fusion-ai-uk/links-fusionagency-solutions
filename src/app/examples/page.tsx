import Link from "next/link";
import { TRACKING_BASE_URL } from "@/config/site";
import styles from "../admin/admin.module.css";

const BASE = TRACKING_BASE_URL;

/**
 * Public reference page — generic patterns only.
 *
 * Live campaign IDs and link IDs are deliberately not listed here, because this
 * page is not behind sign-in. The real per-email packs live at
 * /admin/setup/<campaign-id>.
 */
export default function ExamplesPage() {
  return (
    <main className={styles.page} style={{ maxWidth: 860 }}>
      <Link href="/" className={styles.backLink}>
        ← Service home
      </Link>

      <span className={styles.eyebrowLocal}>Email build · reference</span>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem" }}>
        Email HTML patterns
      </h1>
      <p className={styles.subtitle}>
        Generic patterns only. No merge tags or recipient data are needed
        anywhere. For the exact URLs to use in a specific email, open that
        email&rsquo;s setup pack in the{" "}
        <Link href="/admin">dashboard</Link>.
      </p>

      <h2 className={styles.sectionDivider}>Open tracking pixel</h2>
      <section className={`${styles.panel} ${styles.panelSpaced}`}>
        <p className={styles.sectionHint}>
          Place once near the end of the body, before{" "}
          <code>&lt;/body&gt;</code>. Opens are estimated — mail clients block,
          cache and pre-load tracking pixels.
        </p>
        <pre className={styles.codeBlock}>
          <code>{`<img src="${BASE}/o?cid=CAMPAIGN_ID" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block;" />`}</code>
        </pre>
      </section>

      <h2 className={styles.sectionDivider}>Tracked links</h2>
      <section className={`${styles.panel} ${styles.panelSpaced}`}>
        <p className={styles.sectionHint}>
          Only allowlisted link IDs resolve. An ID that is not configured
          returns not-found rather than redirecting anywhere, so every call to
          action must be set up before the send.
        </p>
        <pre className={styles.codeBlock}>
          <code>{`<a href="${BASE}/c/LINK_ID?cid=CAMPAIGN_ID">Call to action</a>`}</code>
        </pre>
      </section>

      <h2 className={styles.sectionDivider}>Test builds</h2>
      <section className={`${styles.panel} ${styles.panelSpaced}`}>
        <p className={styles.sectionHint}>
          Append <code>-test</code> to the campaign ID. Test traffic uses the
          same allowlisted destinations but records under a separate ID, so it
          never contaminates live reporting.
        </p>
        <pre className={styles.codeBlock}>
          <code>{`<img src="${BASE}/o?cid=CAMPAIGN_ID-test" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block;" />

<a href="${BASE}/c/LINK_ID?cid=CAMPAIGN_ID-test">Call to action</a>`}</code>
        </pre>
      </section>

      <h2 className={styles.sectionDivider}>Rules for the build</h2>
      <section className={`${styles.panel} ${styles.panelWell}`}>
        <ul className={styles.guideDetail}>
          <li>
            Add the open pixel once, near the bottom of the HTML, before{" "}
            <code>&lt;/body&gt;</code>.
          </li>
          <li>Replace only the calls to action listed in the setup pack.</li>
          <li>
            Use <code>/c/LINK_ID?cid=CAMPAIGN_ID</code> for tracked links.
          </li>
          <li>Never change unsubscribe links.</li>
          <li>Never change preference centre links.</li>
          <li>
            Never change legal, compliance or adverse-event reporting links.
          </li>
          <li>Never add email addresses or recipient data to a URL.</li>
        </ul>
      </section>

      <h2 className={styles.sectionDivider}>Query parameters</h2>
      <section className={styles.panel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.mono}>cid</td>
              <td>
                The campaign identifier. Required in every tracking URL. If it
                is missing, the event still records but is reported as{" "}
                <code>unknown</code>.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className={styles.footerSignature}>
        <strong>FUSION</strong> <span>·</span> email link tracking{" "}
        <span>·</span> <strong>INTERNAL</strong>
      </p>
    </main>
  );
}
