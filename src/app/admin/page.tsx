import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/config/users";
import {
  getAllCampaignIdsInDb,
  getCampaignMetrics,
  getDashboardStats,
  type CampaignMetrics,
  type DashboardStats,
} from "@/lib/dashboard";
import {
  CAMPAIGN_STATUS_LABELS,
  getAllCampaigns,
  getTestCampaignId,
  PROGRAMMES,
  type CampaignDefinition,
  type CampaignStatus,
} from "@/config/programmes";
import {
  ALL_PROGRAMMES_ID,
  buildCampaignRows,
  buildProgrammeNav,
  formatClickRate,
  resolveScope,
  type CampaignRowView,
} from "@/lib/programme-view";
import { SOURCE_LINE } from "@/config/help";
import InfoTip from "@/components/InfoTip";
import { logoutAction } from "./actions";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = {
  programme?: string;
  campaign?: string;
  bots?: string;
  tests?: string;
  q?: string;
  status?: string;
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

/** The accent rotation, in the deck's fixed order. A fifth item restarts. */
const ACCENTS = [
  "var(--accent-orange)",
  "var(--accent-cyan)",
  "var(--accent-teal)",
  "var(--accent-violet)",
];

function accentFor(index: number): string {
  return ACCENTS[index % ACCENTS.length];
}

const STATUS_PILL_CLASS: Record<CampaignStatus, string> = {
  planned: styles.pillPlanned,
  "in-review": styles.pillInReview,
  ready: styles.pillReady,
  sent: styles.pillSent,
  closed: styles.pillClosed,
};

const STATUS_ORDER: CampaignStatus[] = [
  "planned",
  "in-review",
  "ready",
  "sent",
  "closed",
];

function dashboardHref(params: SearchParams): string {
  const search = new URLSearchParams();
  if (params.programme && params.programme !== ALL_PROGRAMMES_ID) {
    search.set("programme", params.programme);
  }
  if (params.campaign) search.set("campaign", params.campaign);
  if (params.bots === "exclude") search.set("bots", "exclude");
  if (params.tests === "include") search.set("tests", "include");
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);

  const query = search.toString();
  return query ? `/admin?${query}` : "/admin";
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const excludeBots = params.bots === "exclude";
  const includeTests = params.tests === "include";
  const query = (params.q ?? "").trim();
  const statusFilter = STATUS_ORDER.includes(params.status as CampaignStatus)
    ? (params.status as CampaignStatus)
    : null;

  let dbCampaignIds: string[] = [];
  let stats: DashboardStats | null = null;
  let programmeMetrics: CampaignMetrics[] = [];
  let testMetrics: CampaignMetrics[] = [];
  let dbError: string | null = null;
  let scope: ReturnType<typeof resolveScope> | null = null;

  try {
    dbCampaignIds = await getAllCampaignIdsInDb();

    scope = resolveScope({
      programmeId: params.programme,
      campaignId: params.campaign,
      dbCampaignIds,
      includeTests,
    });

    [stats, programmeMetrics, testMetrics] = await Promise.all([
      getDashboardStats({ campaignIds: scope.filterCampaignIds, excludeBots }),
      getCampaignMetrics({
        campaignIds: scope.programmeCampaignIds,
        excludeBots,
      }),
      getCampaignMetrics({
        campaignIds: scope.programmeCampaignIds.map(getTestCampaignId),
        excludeBots,
      }),
    ]);
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
    console.error("[admin] dashboard query failed:", error);
  }

  const header = (
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrowLocal}>
          Fusion Data &amp; AI · Email tracking
        </span>
        <h1>Campaign tracking repository</h1>
        <p className={styles.subtitle}>
          Every tracked email, grouped by client programme. Open and click
          activity is recorded at campaign level — there are no recipient
          identifiers in this system.
        </p>
      </div>
      <div className={styles.headerActions}>
        <span className={styles.userChip}>
          <span className={styles.userChipName}>{user.name}</span>
          <span className={styles.userChipRole}>{ROLE_LABELS[user.role]}</span>
        </span>
        <Link href="/admin/guide" className={styles.buttonSecondary}>
          How to read this
        </Link>
        <form action={logoutAction}>
          <button type="submit" className={styles.buttonSecondary}>
            Sign out
          </button>
        </form>
      </div>
    </header>
  );

  if (!stats || !scope) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.errorBanner}>
          <h2>The database cannot be reached</h2>
          <p>
            No figures can be shown while this is the case, and no new opens or
            clicks are being recorded. Nothing already recorded is lost.
          </p>
          <p>
            Check that the Postgres database is active and connected in Vercel
            (Storage), then redeploy. <code>/health</code> should return{" "}
            <code>{`{"database":"connected"}`}</code>.
          </p>
          {dbError && <pre className={styles.errorDetail}>{dbError}</pre>}
        </div>
      </div>
    );
  }

  const nav = buildProgrammeNav(dbCampaignIds);
  const definitions: CampaignDefinition[] = scope.programme
    ? scope.programme.campaigns
    : getAllCampaigns();

  const allRows = buildCampaignRows({
    campaignIds: scope.programmeCampaignIds,
    definitions,
    metricsByCampaign: programmeMetrics,
    testMetricsByCampaign: testMetrics,
  });

  // Search and status narrow the list only; they never change the figures.
  const lowerQuery = query.toLowerCase();
  const rows = allRows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (!lowerQuery) return true;
    return (
      row.label.toLowerCase().includes(lowerQuery) ||
      row.id.toLowerCase().includes(lowerQuery) ||
      row.linkIds.some((id) => id.toLowerCase().includes(lowerQuery))
    );
  });

  const exportSearch = new URLSearchParams();
  for (const id of scope.filterCampaignIds) exportSearch.append("campaign", id);
  if (excludeBots) exportSearch.set("bots", "exclude");
  const exportHref = `/admin/export.csv?${exportSearch.toString()}`;
  const mayExport = can(user.role, "exportCsv");

  const programmeIndex = scope.programme
    ? PROGRAMMES.findIndex((p) => p.id === scope!.programme!.id)
    : -1;
  const scopeAccent =
    programmeIndex >= 0 ? accentFor(programmeIndex) : "var(--border)";

  const scopeLabel = scope.programme
    ? scope.programme.label
    : scope.isUnassigned
      ? "Unassigned campaign IDs"
      : "All programmes";

  const selectedRow = scope.selectedCampaignId
    ? allRows.find((row) => row.id === scope!.selectedCampaignId)
    : null;

  const awaitingSetup = allRows.filter((row) => !row.hasTrackedLinks).length;
  const hasAnyEvents = stats.totalOpens > 0 || stats.totalClicks > 0;
  // Test sends are hidden by default; say so when there is something to see.
  const hiddenTestEvents = includeTests
    ? 0
    : testMetrics.reduce((sum, m) => sum + m.opens + m.clicks, 0);

  // A plain-words summary of what is currently on screen.
  const summaryParts = [
    scopeLabel,
    selectedRow ? selectedRow.label : `all ${allRows.length} emails`,
    excludeBots ? "likely bots excluded" : "bots included",
    includeTests ? "test sends included" : "test sends hidden",
  ];
  if (query) summaryParts.push(`list filtered by "${query}"`);
  if (statusFilter)
    summaryParts.push(`status ${CAMPAIGN_STATUS_LABELS[statusFilter]}`);

  return (
    <div className={styles.page}>
      {header}

      <nav className={styles.programmeNav} aria-label="Programme">
        <Link
          href={dashboardHref({
            ...params,
            programme: undefined,
            campaign: undefined,
          })}
          className={`${styles.programmeTab} ${
            scope.isAllProgrammes ? styles.programmeTabActive : ""
          }`}
        >
          <span className={styles.programmeTabLabel}>All programmes</span>
          <span className={styles.programmeTabMeta}>
            <span className={styles.programmeTabCount}>
              {getAllCampaigns().length}
            </span>{" "}
            emails tracked
          </span>
        </Link>

        {nav.map((item) => {
          const index = PROGRAMMES.findIndex((p) => p.id === item.id);
          const accent = item.isUnassigned
            ? "var(--text-quaternary)"
            : accentFor(index);
          const active =
            scope!.programmeId === item.id && !scope!.isAllProgrammes;

          return (
            <Link
              key={item.id}
              href={dashboardHref({
                ...params,
                programme: item.id,
                campaign: undefined,
              })}
              className={`${styles.programmeTab} ${
                active ? styles.programmeTabActive : ""
              }`}
              style={{ ["--item-accent" as string]: accent }}
            >
              <span className={styles.programmeTabLabel}>{item.label}</span>
              <span className={styles.programmeTabMeta}>
                {item.isUnassigned ? (
                  <>
                    <span className={styles.programmeTabCount}>
                      {item.campaignCount}
                    </span>{" "}
                    unrecognised
                  </>
                ) : (
                  <>
                    {item.client} ·{" "}
                    <span className={styles.programmeTabCount}>
                      {item.campaignCount}
                    </span>{" "}
                    email{item.campaignCount === 1 ? "" : "s"}
                  </>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.programmeHeader}>
        {scope.programme && (
          <span className={styles.clientChip}>
            Client · {scope.programme.client}
          </span>
        )}
        <h2>
          {scopeLabel}
          <InfoTip topic="programme" />
        </h2>
        {scope.programme?.description && (
          <p className={styles.programmeDescription}>
            {scope.programme.description}
          </p>
        )}
        {scope.isAllProgrammes && (
          <p className={styles.programmeDescription}>
            A service-wide total across unrelated client audiences. Useful for a
            sense of volume; pick a programme before reading anything into the
            figures.
          </p>
        )}
        {scope.isUnassigned && (
          <p className={styles.programmeDescription}>
            Campaign IDs recorded in the data that no programme claims —
            normally a typo in an email build, a legacy send, or a pixel
            requested with no ID at all. Nothing is discarded, so anything
            unexpected shows up here.
          </p>
        )}
      </div>

      <div className={styles.notice}>
        <span className={styles.noticeHead}>Before you read these numbers</span>
        Opens are <strong>estimates</strong>. Mail clients block, cache and
        pre-load tracking pixels, so opens are under-counted and over-counted at
        the same time. Approximate unique counts group by hashed IP address and
        mail client; they are a rough de-duplication and{" "}
        <strong>not a count of people</strong>. Clicks are the more dependable
        signal.
        <p className={styles.noticeLinks}>
          <Link href="/admin/guide">
            Read the full guide to these figures →
          </Link>
        </p>
      </div>

      <form method="get" className={styles.filterBar}>
        {scope.programme && (
          <input type="hidden" name="programme" value={scope.programme.id} />
        )}
        {scope.isUnassigned && (
          <input type="hidden" name="programme" value="unassigned" />
        )}

        <div className={styles.filterRow}>
          <div className={styles.filterField}>
            <label className={styles.filterLabel} htmlFor="campaign">
              Focus figures on
              <InfoTip topic="campaignId" label="Focus figures on" />
            </label>
            <select
              id="campaign"
              name="campaign"
              defaultValue={scope.selectedCampaignId ?? ""}
            >
              <option value="">
                Every email in {scope.programme ? "this programme" : "view"}
              </option>
              {allRows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label className={styles.filterLabel} htmlFor="q">
              Search the list
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Email name, campaign ID or link ID"
            />
          </div>

          <div className={styles.filterField}>
            <label className={styles.filterLabel} htmlFor="status">
              Status
              <InfoTip topic="status" />
            </label>
            <select id="status" name="status" defaultValue={statusFilter ?? ""}>
              <option value="">Any status</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {CAMPAIGN_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.toggleGroup}>
            <span className={styles.toggle}>
              <input
                type="checkbox"
                id="bots"
                name="bots"
                value="exclude"
                defaultChecked={excludeBots}
              />
              <label htmlFor="bots">Exclude likely bots</label>
              <InfoTip topic="bots" />
            </span>
            <span className={styles.toggle}>
              <input
                type="checkbox"
                id="tests"
                name="tests"
                value="include"
                defaultChecked={includeTests}
              />
              <label htmlFor="tests">Include test sends</label>
              <InfoTip topic="testSends" />
            </span>
          </div>

          <div className={styles.filterActions}>
            <button type="submit" className={styles.buttonPrimary}>
              Apply
            </button>
            {mayExport ? (
              <a href={exportHref} className={styles.buttonSecondary}>
                Export CSV
              </a>
            ) : (
              <span
                className={styles.buttonDisabled}
                title="The raw event export is limited to administrator accounts."
              >
                Export CSV
              </span>
            )}
            <InfoTip topic="csvExport" />
          </div>
        </div>

        <p className={styles.filterSummary}>
          {`// showing: ${summaryParts.join(" · ")}`}
        </p>
      </form>

      <section className={styles.statsGrid}>
        <div
          className={styles.statCard}
          style={{ ["--item-accent" as string]: accentFor(0) }}
        >
          <span className={styles.statLabel}>
            Total opens
            <InfoTip topic="totalOpens" />
          </span>
          <span className={styles.statValue}>
            {stats.totalOpens.toLocaleString("en-GB")}
          </span>
          <span className={styles.statHint}>
            Estimated. Pixel loads, not people.
          </span>
        </div>

        <div
          className={styles.statCard}
          style={{ ["--item-accent" as string]: accentFor(1) }}
        >
          <span className={styles.statLabel}>
            Approx. unique opens
            <InfoTip topic="approxUnique" />
          </span>
          <span className={styles.statValue}>
            {stats.approximateUniqueOpens.toLocaleString("en-GB")}
          </span>
          <span className={styles.statHint}>
            Distinct hashed IP + mail client. Not recipients.
          </span>
        </div>

        <div
          className={styles.statCard}
          style={{ ["--item-accent" as string]: accentFor(2) }}
        >
          <span className={styles.statLabel}>
            Total clicks
            <InfoTip topic="totalClicks" />
          </span>
          <span className={styles.statValue}>
            {stats.totalClicks.toLocaleString("en-GB")}
          </span>
          <span className={styles.statHint}>
            Tracked links followed. Clicks, not clickers.
          </span>
        </div>

        <div
          className={styles.statCard}
          style={{ ["--item-accent" as string]: accentFor(3) }}
        >
          <span className={styles.statLabel}>
            Approx. unique clicks
            <InfoTip topic="approxUnique" />
          </span>
          <span className={styles.statValue}>
            {stats.approximateUniqueClicks.toLocaleString("en-GB")}
          </span>
          <span className={styles.statHint}>
            Distinct hashed IP + mail client. Not recipients.
          </span>
        </div>

        <div
          className={styles.statCard}
          style={{ ["--item-accent" as string]: accentFor(4) }}
        >
          <span className={styles.statLabel}>
            Clicks per open
            <InfoTip topic="clicksPerOpen" />
          </span>
          <span className={styles.statValue}>
            {formatClickRate(stats.totalOpens, stats.totalClicks)}
          </span>
          <span className={styles.statHint}>
            A rough ratio. Can exceed 100%.
          </span>
        </div>
      </section>

      <p className={styles.sourceLineBlock}>{SOURCE_LINE}</p>

      <section className={`${styles.panel} ${styles.panelSpaced}`}>
        <div className={styles.sectionTitleRow}>
          <div className={styles.sectionTitleGroup}>
            <h2>Emails in this view</h2>
            <InfoTip topic="trackedCtas" label="Emails in this view" />
          </div>
          <p className={styles.sectionHint}>
            {rows.length === allRows.length
              ? `${allRows.length} email${allRows.length === 1 ? "" : "s"} · ${awaitingSetup} awaiting tracking setup`
              : `${rows.length} of ${allRows.length} shown · list filtered`}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className={styles.emptyState}>
            <strong>Nothing matches that filter.</strong> Clear the search box
            or set status back to Any status.
          </p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>
                    Campaign ID
                    <InfoTip topic="campaignId" />
                  </th>
                  <th>
                    Status
                    <InfoTip topic="status" />
                  </th>
                  <th>Send date</th>
                  <th>
                    Tracked CTAs
                    <InfoTip topic="trackedCtas" />
                  </th>
                  <th className={styles.numeric}>
                    Opens
                    <InfoTip topic="totalOpens" />
                  </th>
                  <th className={styles.numeric}>
                    Clicks
                    <InfoTip topic="totalClicks" />
                  </th>
                  <th className={styles.numeric}>
                    Clicks/open
                    <InfoTip topic="clicksPerOpen" />
                  </th>
                  <th>Setup</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <WaveRow
                    key={row.id}
                    row={row}
                    selected={scope!.selectedCampaignId === row.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hiddenTestEvents > 0 && (
          <p className={styles.emptyState} style={{ marginTop: "1rem" }}>
            <strong>
              {hiddenTestEvents} test event{hiddenTestEvents === 1 ? "" : "s"}{" "}
              recorded for this view — hidden from the figures.
            </strong>{" "}
            Test sends use the <code>-test</code> campaign ID and are kept out
            of live reporting.{" "}
            <Link href={dashboardHref({ ...params, tests: "include" })}>
              Show test sends →
            </Link>{" "}
            or open an email&rsquo;s <em>Set up</em> page to see each test
            click by link.
          </p>
        )}
        {!hasAnyEvents && (
          <p className={styles.emptyState} style={{ marginTop: "1rem" }}>
            <strong>No tracking events recorded in this view yet.</strong> That
            is the expected state while emails are in approval, or before a
            first send. Open <em>Set up</em> on a row to generate the pixel and
            link URLs the email build needs.
          </p>
        )}
      </section>

      <div className={styles.twoCol}>
        <section className={styles.panel}>
          <div className={styles.sectionTitleRow}>
            <div className={styles.sectionTitleGroup}>
              <h2>Clicks by link</h2>
              <InfoTip topic="linkId" label="Clicks by link" />
            </div>
          </div>
          {stats.clicksByLinkId.length === 0 ? (
            <p className={styles.empty}>
              No clicks recorded in this view yet.
            </p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Link ID</th>
                  <th className={styles.numeric}>Clicks</th>
                </tr>
              </thead>
              <tbody>
                {stats.clicksByLinkId.map((row) => (
                  <tr key={row.linkId}>
                    <td className={styles.mono}>{row.linkId}</td>
                    <td className={styles.numeric}>
                      {row.count.toLocaleString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className={styles.sourceLine}>
            Counts cover only the emails in the current view. The same link ID
            can be used in more than one email.
          </p>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionTitleRow}>
            <div className={styles.sectionTitleGroup}>
              <h2>Approximate uniques by email</h2>
              <InfoTip topic="duplication" label="Approximate uniques" />
            </div>
          </div>
          {allRows.length === 0 ? (
            <p className={styles.empty}>Nothing to show.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th className={styles.numeric}>Uniq. opens</th>
                  <th className={styles.numeric}>Uniq. clicks</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    <td className={styles.numeric}>
                      {row.metrics.approxUniqueOpens.toLocaleString("en-GB")}
                    </td>
                    <td className={styles.numeric}>
                      {row.metrics.approxUniqueClicks.toLocaleString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className={styles.sourceLine}>
            These do not add up to the programme figure above. One person who
            opened two emails counts once in each row and once overall.
          </p>
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionTitleRow}>
          <div className={styles.sectionTitleGroup}>
            <h2>Recent events</h2>
            <InfoTip topic="recentEvents" />
          </div>
          <p className={styles.sectionHint}>
            Latest 50 in this view · times in UTC
          </p>
        </div>
        {stats.recentEvents.length === 0 ? (
          <p className={styles.empty}>No events recorded in this view yet.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Type</th>
                  <th>Campaign ID</th>
                  <th>Link ID</th>
                  <th>
                    Location
                    <InfoTip topic="location" />
                  </th>
                  <th>
                    Likely bot
                    <InfoTip topic="bots" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.recentEvents.map((event) => (
                  <tr key={event.id}>
                    <td className={styles.mono}>
                      {event.createdAt
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 19)}
                    </td>
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
                    <td className={styles.mono}>{event.campaignId ?? "—"}</td>
                    <td className={styles.mono}>{event.linkId ?? "—"}</td>
                    <td>{event.ipCountry ?? "—"}</td>
                    <td>{event.isBot ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.footerSignature}>
        <strong>FUSION</strong> <span>·</span> email link tracking{" "}
        <span>·</span> <strong>INTERNAL</strong>
      </p>
    </div>
  );
}

function WaveRow({
  row,
  selected,
}: {
  row: CampaignRowView;
  selected: boolean;
}) {
  const testEvents = row.testMetrics
    ? row.testMetrics.opens + row.testMetrics.clicks
    : 0;

  return (
    <tr className={selected ? styles.rowSelected : undefined}>
      <td>
        <span className={styles.rowHead}>{row.label}</span>
        {row.notes && <span className={styles.rowNote}>{row.notes}</span>}
      </td>
      <td>
        <span className={styles.mono}>{row.id}</span>
        {testEvents > 0 && (
          <span className={styles.rowNoteAccent}>
            {`// ${testEvents} test event${testEvents === 1 ? "" : "s"} recorded`}
          </span>
        )}
      </td>
      <td>
        {row.status ? (
          <span className={`${styles.pill} ${STATUS_PILL_CLASS[row.status]}`}>
            {CAMPAIGN_STATUS_LABELS[row.status]}
          </span>
        ) : (
          <span className={`${styles.pill} ${styles.pillNone}`}>
            Not defined
          </span>
        )}
      </td>
      <td>{row.sendDate ?? "TBC"}</td>
      <td>
        {row.hasTrackedLinks ? (
          <span className={`${styles.pill} ${styles.pillOk}`}>
            {row.linkIds.length} link{row.linkIds.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className={`${styles.pill} ${styles.pillPending}`}>
            Not set up
          </span>
        )}
      </td>
      <td className={styles.numeric}>
        {row.metrics.opens.toLocaleString("en-GB")}
      </td>
      <td className={styles.numeric}>
        {row.metrics.clicks.toLocaleString("en-GB")}
      </td>
      <td className={styles.numeric}>
        {formatClickRate(row.metrics.opens, row.metrics.clicks)}
      </td>
      <td>
        <Link
          href={`/admin/setup/${encodeURIComponent(row.id)}`}
          className={styles.linkAction}
        >
          {row.hasTrackedLinks ? "View pack →" : "Set up →"}
        </Link>
      </td>
    </tr>
  );
}
