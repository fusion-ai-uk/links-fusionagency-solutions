import Link from "next/link";
import { TRACKING_BASE_URL } from "@/config/site";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ marginTop: 0 }}>Email Link Tracking</h1>
      <p style={{ color: "var(--muted)", fontSize: "1.05rem" }}>
        Fusion Agency Solutions — campaign-level tracking for IMI marketing
        emails at{" "}
        <strong>{TRACKING_BASE_URL.replace("https://", "")}</strong>.
      </p>

      <ul style={{ lineHeight: 2 }}>
        <li>
          <Link href="/admin">Admin dashboard</Link>
        </li>
        <li>
          <Link href="/examples">Email HTML examples</Link>
        </li>
        <li>
          <a href="/health">Health check</a>
        </li>
      </ul>

      <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginTop: "2rem" }}>
        Tracking URLs: <code>/o?cid=CAMPAIGN_ID</code> (open pixel),{" "}
        <code>/c/LINK_ID?cid=CAMPAIGN_ID</code> (click redirect).
      </p>
    </main>
  );
}
