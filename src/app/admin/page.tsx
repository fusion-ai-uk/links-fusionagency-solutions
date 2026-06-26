import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { getDashboardStats, type DashboardStats } from "@/lib/dashboard";
import { getCampaignOptions } from "@/config/campaigns";
import { logoutAction } from "./actions";
import styles from "./admin.module.css";

// Always render on demand; never prerender (depends on cookies + live DB).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  searchParams: Promise<{ campaign?: string }>;
};

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    redirect("/admin/login");
  }

  const { campaign } = await searchParams;

  // Never let a DB outage crash the dashboard with a raw server-side exception.
  let stats: DashboardStats | null = null;
  let dbError: string | null = null;
  try {
    stats = await getDashboardStats(campaign);
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
    console.error("[admin] getDashboardStats failed:", error);
  }

  const exportHref =
    campaign && campaign !== "all"
      ? `/admin/export.csv?campaign=${encodeURIComponent(campaign)}`
      : "/admin/export.csv";

  if (!stats) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1>Email Tracking Dashboard</h1>
            <p className={styles.subtitle}>Fusion Agency Solutions — campaign-level metrics</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className={styles.buttonSecondary}>
              Log out
            </button>
          </form>
        </header>
        <div className={styles.errorBanner}>
          <h2>Database unavailable</h2>
          <p>
            The dashboard could not reach the database, so no metrics can be shown
            right now. Tracking events cannot be recorded until this is restored.
          </p>
          <p>
            Check that the Postgres/Neon database is active and connected in Vercel
            (Storage), then redeploy. Verify <code>/health</code> returns{" "}
            <code>{`{"database":"connected"}`}</code>.
          </p>
          {dbError && (
            <pre className={styles.errorDetail}>{dbError}</pre>
          )}
        </div>
      </div>
    );
  }

  const campaignOptions = getCampaignOptions(stats.campaigns);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Email Tracking Dashboard</h1>
          <p className={styles.subtitle}>Fusion Agency Solutions — campaign-level metrics</p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className={styles.buttonSecondary}>
            Log out
          </button>
        </form>
      </header>

      <p className={styles.notice}>
        Campaign-level tracking only. Approximate unique counts use hashed IP + user
        agent — they do not identify individual recipients.
      </p>

      <form method="get" className={styles.filterBar}>
        <label htmlFor="campaign">Campaign filter</label>
        <select id="campaign" name="campaign" defaultValue={campaign ?? "all"}>
          <option value="all">All campaigns</option>
          {campaignOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" className={styles.buttonPrimary}>
          Apply
        </button>
        <a href={exportHref} className={styles.buttonSecondary}>
          Export CSV
        </a>
      </form>

      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total opens</span>
          <span className={styles.statValue}>{stats.totalOpens}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Approx. unique opens</span>
          <span className={styles.statValue}>{stats.approximateUniqueOpens}</span>
          <span className={styles.statHint}>cid + ip_hash + user_agent</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total clicks</span>
          <span className={styles.statValue}>{stats.totalClicks}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Approx. unique clicks</span>
          <span className={styles.statValue}>{stats.approximateUniqueClicks}</span>
          <span className={styles.statHint}>cid + ip_hash + user_agent</span>
        </div>
      </section>

      <div className={styles.twoCol}>
        <section className={styles.panel}>
          <h2>Clicks by link ID</h2>
          {stats.clicksByLinkId.length === 0 ? (
            <p className={styles.empty}>No click data yet.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Link ID</th>
                  <th>Clicks</th>
                </tr>
              </thead>
              <tbody>
                {stats.clicksByLinkId.map((row) => (
                  <tr key={row.linkId}>
                    <td>
                      <code>{row.linkId}</code>
                    </td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.panel}>
          <h2>Events by campaign</h2>
          {stats.eventsByCampaign.length === 0 ? (
            <p className={styles.empty}>No campaign data yet.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Opens</th>
                  <th>Clicks</th>
                </tr>
              </thead>
              <tbody>
                {stats.eventsByCampaign.map((row) => (
                  <tr key={row.campaignId}>
                    <td>
                      <code>{row.campaignId}</code>
                    </td>
                    <td>{row.opens}</td>
                    <td>{row.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <h2>Recent events</h2>
        {stats.recentEvents.length === 0 ? (
          <p className={styles.empty}>No events recorded yet.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Campaign</th>
                  <th>Link</th>
                  <th>Country</th>
                  <th>Bot</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{event.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                    <td>
                      <span
                        className={
                          event.eventType === "open"
                            ? styles.badgeOpen
                            : styles.badgeClick
                        }
                      >
                        {event.eventType}
                      </span>
                    </td>
                    <td>{event.campaignId ?? "—"}</td>
                    <td>{event.linkId ?? "—"}</td>
                    <td>{event.ipCountry ?? "—"}</td>
                    <td>{event.isBot ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
