import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ marginTop: 0 }}>Email Link Tracking</h1>
      <p style={{ color: "var(--muted)", fontSize: "1.05rem" }}>
        Fusion Agency Solutions — private tracking service for IMI marketing
        emails at{" "}
        <strong>links.fusionagency.solutions</strong>.
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
        Tracking endpoints: <code>/o</code> (open pixel),{" "}
        <code>/c/[linkId]</code> (click redirect).
      </p>
    </main>
  );
}
