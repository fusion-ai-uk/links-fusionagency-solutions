import Link from "next/link";
import { getLinkIds } from "@/config/links";
import { TRACKING_BASE_URL } from "@/config/site";

const BASE = TRACKING_BASE_URL;
const EXAMPLE_CAMPAIGN = "imi-lyvdelzi-may-2026";

export default function ExamplesPage() {
  const linkIds = getLinkIds();

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem 3rem" }}>
      <p>
        <Link href="/">← Home</Link>
      </p>

      <h1>Email HTML Examples</h1>
      <p style={{ color: "var(--muted)" }}>
        Campaign-level tracking only — replace <code>CAMPAIGN_ID</code> with your
        campaign slug. No IMI merge tags are required.
      </p>

      <h2>Open tracking pixel</h2>
      <p>
        Place this 1×1 image near the end of the email body (before{" "}
        <code>&lt;/body&gt;</code>). Opens are <em>estimated</em> — see README
        for limitations.
      </p>
      <pre>
        <code>{`<img src="${BASE}/o?cid=CAMPAIGN_ID" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block;" />`}</code>
      </pre>

      <h2>Tracked CTA links</h2>
      <p>
        Use allowlisted link IDs only. Configured IDs:{" "}
        {linkIds.map((id) => (
          <code key={id} style={{ marginRight: "0.5rem" }}>
            {id}
          </code>
        ))}
      </p>
      <pre>
        <code>{`<a href="${BASE}/c/LINK_ID?cid=CAMPAIGN_ID">CTA text</a>`}</code>
      </pre>

      <h2>Real example (imi-lyvdelzi-may-2026)</h2>
      <pre>
        <code>{`<img src="${BASE}/o?cid=${EXAMPLE_CAMPAIGN}" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block;" />

<a href="${BASE}/c/see-recap?cid=${EXAMPLE_CAMPAIGN}">See the recap</a>
<a href="${BASE}/c/access-full-data?cid=${EXAMPLE_CAMPAIGN}">Access full data</a>
<a href="${BASE}/c/view-now-biochemical-levels?cid=${EXAMPLE_CAMPAIGN}">View now</a>`}</code>
      </pre>

      <h2>Instructions for the email HTML build</h2>
      <ul style={{ lineHeight: 1.8 }}>
        <li>Add the open pixel once near the bottom of the email HTML, ideally before <code>&lt;/body&gt;</code></li>
        <li>Replace only the CTA/button links you want to track</li>
        <li>Use <code>/c/LINK_ID?cid=CAMPAIGN_ID</code> for tracked links</li>
        <li>Do not change unsubscribe links</li>
        <li>Do not change preference centre links</li>
        <li>Do not change legal or compliance links</li>
        <li>Do not add raw email addresses to URLs</li>
        <li>No IMI merge tags are needed</li>
      </ul>

      <h2>Query parameters</h2>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.9rem",
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "0.5rem" }}>
              Param
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: "0.5rem" }}>
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: "0.5rem" }}>
              <code>cid</code>
            </td>
            <td style={{ padding: "0.5rem" }}>
              Campaign identifier (required in URLs; logged as &quot;unknown&quot; if missing)
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
