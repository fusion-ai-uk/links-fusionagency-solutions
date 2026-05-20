import Link from "next/link";
import { getLinkIds } from "@/config/links";

const BASE = "https://links.fusionagency.solutions";

export default function ExamplesPage() {
  const linkIds = getLinkIds();

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem 3rem" }}>
      <p>
        <Link href="/">← Home</Link>
      </p>

      <h1>Email HTML Examples</h1>
      <p style={{ color: "var(--muted)" }}>
        Copy these snippets into your IMI email templates. Replace{" "}
        <code>CAMPAIGN_ID</code>, <code>RECIPIENT_TOKEN</code>, and{" "}
        <code>MESSAGE_ID</code> with values from IMI merge fields.
      </p>

      <h2>Open tracking pixel</h2>
      <p>
        Place this 1×1 image near the end of the email body (before{" "}
        <code>&lt;/body&gt;</code>). Opens are <em>estimated</em> — see README
        for limitations.
      </p>
      <pre>
        <code>{`<img src="${BASE}/o?cid=CAMPAIGN_ID&rid=RECIPIENT_TOKEN&mid=MESSAGE_ID" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block;" />`}</code>
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
        <code>{`<a href="${BASE}/c/hero-button?cid=CAMPAIGN_ID&rid=RECIPIENT_TOKEN&mid=MESSAGE_ID">Learn more</a>`}</code>
      </pre>
      <pre>
        <code>{`<a href="${BASE}/c/secondary-cta?cid=CAMPAIGN_ID&rid=RECIPIENT_TOKEN&mid=MESSAGE_ID">Contact us</a>`}</code>
      </pre>

      <h2>Do not modify</h2>
      <div
        style={{
          padding: "1rem",
          background: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: 8,
          marginTop: "1rem",
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>Important:</strong> Do not wrap or replace unsubscribe links,
          preference centre links, legal disclaimers, or compliance-related URLs
          with this tracking service. Those must remain direct links as required
          by email regulations and IMI configuration.
        </p>
      </div>

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
            <td style={{ padding: "0.5rem" }}>Campaign identifier from IMI</td>
          </tr>
          <tr>
            <td style={{ padding: "0.5rem" }}>
              <code>rid</code>
            </td>
            <td style={{ padding: "0.5rem" }}>
              Opaque recipient token from IMI (not an email address)
            </td>
          </tr>
          <tr>
            <td style={{ padding: "0.5rem" }}>
              <code>mid</code>
            </td>
            <td style={{ padding: "0.5rem" }}>Message / send identifier</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
