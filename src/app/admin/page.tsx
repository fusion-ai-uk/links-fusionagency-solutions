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
  ECHO_WINDOW_OPTIONS,
  parseEchoWindow,
} from "@/lib/duplication";
import { CLIENT_KIND_LABELS } from "@/lib/request-hints";
import { BOT_REASON_LABELS } from "@/lib/bot-detect";
import { formatUkTime, UK_TIME_LABEL } from "@/lib/time";
import {
  loadTriage,
  PHASE_LABELS,
  phaseOf,
  REASON_LABELS,
  type TriageResult,
} from "@/lib/triage";
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
  collapse?: string;
  window?: string;
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

function toQuery(params: SearchParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.programme && params.programme !== ALL_PROGRAMMES_ID) {
    search.set("programme", params.programme);
  }
  if (params.campaign) search.set("campaign", params.campaign);
  if (params.bots === "exclude") search.set("bots", "exclude");
  if (params.tests === "include") search.set("tests", "include");
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.collapse === "1") search.set("collapse", "1");
  if (params.window) search.set("window", params.window);
  return search;
}

function dashboardHref(params: SearchParams): string {
  const query = toQuery(params).toString();
  return query ? `/admin?${query}` : "/admin";
}

function duplicationHref(params: SearchParams): string {
  const search = toQuery({ ...params, q: undefined, status: undefined });
  search.delete("collapse");
  const query = search.toString();
  return query ? `/admin/duplication?${query}` : "/admin/duplication";
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const excludeBots = params.bots === "exclude";
  const includeTests = params.tests === "include";
  const collapseEchoes = params.collapse === "1";
  const echoWindowSeconds = parseEchoWindow(params.window);
  const query = (params.q ?? "").trim();
  const statusFilter = STATUS_ORDER.includes(params.status as CampaignStatus)
    ? (params.status as CampaignStatus)
    : null;

  let dbCampaignIds: string[] = [];
  let stats: DashboardStats | null = null;
  let programmeMetrics: CampaignMetrics[] = [];
  let testMetrics: CampaignMetrics[] = [];
  let triage: TriageResult | null = null;
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

    const options = { collapseEchoes, echoWindowSeconds };

    [stats, programmeMetrics, testMetrics, triage] =
      await Promise.all([
        getDashboardStats(
          {
            campaignIds: scope.filterCampaignIds,
            excludeBots,
            liveWindows: scope.liveWindows,
          },
          options
        ),
        getCampaignMetrics(
          {
            campaignIds: scope.programmeCampaignIds,
            excludeBots,
            liveWindows: scope.liveWindows,
          },
          options
        ),
        getCampaignMetrics({
          campaignIds: scope.programmeCampaignIds.map(getTestCampaignId),
          excludeBots,
        }),
        loadTriage(
          scope.selectedCampaignId
            ? [scope.selectedCampaignId]
            : scope.programmeCampaignIds,
          echoWindowSeconds
        ),
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
        <Link href={duplicationHref(params)} className={styles.buttonSecondary}>
          Duplication
        </Link>
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
            <code>{`{"database":"connected","schema":"current"}`}</code>.
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
  // Pre-send comes from the triage pass — the same numbers the waterfall shows.
  const hiddenPreSendEvents =
    includeTests || !triage ? 0 : triage.clicks.preSend + triage.opens.preSend;
  const detectedEchoes = stats.echoEventIds.size;
  const detectedRepeats = stats.repeatEventIds.size;

  // A plain-words summary of what is currently on screen.
  const summaryParts = [
    scopeLabel,
    selectedRow ? selectedRow.label : `all ${allRows.length} emails`,
    excludeBots ? "likely bots excluded" : "bots included",
    includeTests ? "test sends included" : "test sends hidden",
    collapseEchoes
      ? `echoes within ${echoWindowSeconds}s collapsed`
      : "every click counted",
  ];
  if (query) summaryParts.push(`list filtered by "${query}"`);
  if (statusFilter)
    summaryParts.push(`status ${CAMPAIGN_STATUS_LABELS[statusFilter]}`);

  const clicksHint = collapseEchoes && stats.collapse
    ? `${stats.collapse.echoEvents} echo${stats.collapse.echoEvents === 1 ? "" : "es"} and ${stats.collapse.repeatEvents} repeat${stats.collapse.repeatEvents === 1 ? "" : "s"} collapsed.`
    : detectedEchoes + detectedRepeats > 0
      ? `${detectedEchoes} likely echo${detectedEchoes === 1 ? "" : "es"}, ${detectedRepeats} repeat${detectedRepeats === 1 ? "" : "s"} detected — not collapsed.`
      : "Tracked links followed. Clicks, not clickers.";

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
        signal — but security scanners can echo a click from a second address
        seconds later, which is what the collapse toggle is for.
        <p className={styles.noticeLinks}>
          <Link href="/admin/guide">Read the full guide →</Link>
          {"  ·  "}
          <Link href={duplicationHref(params)}>
            See the duplication analysis →
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
            <span className={styles.toggle}>
              <input
                type="checkbox"
                id="collapse"
                name="collapse"
                value="1"
                defaultChecked={collapseEchoes}
              />
              <label htmlFor="collapse">Collapse near-simultaneous echoes</label>
              <InfoTip topic="collapsedClicks" />
              <select
                name="window"
                aria-label="Echo window in seconds"
                defaultValue={String(echoWindowSeconds)}
                className={styles.inlineSelect}
              >
                {ECHO_WINDOW_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    within {seconds}s
                  </option>
                ))}
              </select>
              <InfoTip topic="echoWindow" />
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
            {collapseEchoes ? "Collapsed clicks" : "Total clicks"}
            <InfoTip topic={collapseEchoes ? "collapsedClicks" : "totalClicks"} />
          </span>
          <span className={styles.statValue}>
            {stats.totalClicks.toLocaleString("en-GB")}
          </span>
          <span className={styles.statHint}>{clicksHint}</span>
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
            {collapseEchoes
              ? "Over primary clicks only. Not recipients."
              : "Distinct hashed IP + mail client. Not recipients."}
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

      <p className={styles.sourceLineBlock}>
        {SOURCE_LINE}
        {collapseEchoes &&
          ` Click figures collapse near-simultaneous events on the same link within ${echoWindowSeconds} seconds to one.`}
      </p>

      {triage && (
        <section className={`${styles.panel} ${styles.panelSpaced}`}>
          <div className={styles.sectionTitleRow}>
            <div className={styles.sectionTitleGroup}>
              <h2>Click triage — from raw to genuine</h2>
              <InfoTip topic="triage" />
            </div>
            <p className={styles.sectionHint}>
              {scope.selectedCampaignId ? "This email" : "Emails in this view"} ·
              every click recorded, classified · window {echoWindowSeconds}s
            </p>
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th className={styles.numeric}>Clicks</th>
                  <th className={styles.numeric}>Opens</th>
                  <th>What it means</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.rowHead}>Raw events</td>
                  <td className={styles.numeric}>{triage.clicks.raw}</td>
                  <td className={styles.numeric}>{triage.opens.raw}</td>
                  <td className={styles.rowNote} style={{ display: "table-cell" }}>
                    Everything recorded on these campaign IDs and their -test twins.
                  </td>
                </tr>
                <tr>
                  <td>− Test</td>
                  <td className={styles.numeric}>{triage.clicks.test}</td>
                  <td className={styles.numeric}>{triage.opens.test}</td>
                  <td className={styles.rowNote} style={{ display: "table-cell" }}>
                    On a -test campaign ID.
                  </td>
                </tr>
                <tr>
                  <td>− Pre-send</td>
                  <td className={styles.numeric}>{triage.clicks.preSend}</td>
                  <td className={styles.numeric}>{triage.opens.preSend}</td>
                  <td className={styles.rowNote} style={{ display: "table-cell" }}>
                    On the live ID before the email was sent.
                  </td>
                </tr>
                <tr>
                  <td className={styles.rowHead}>= Live</td>
                  <td className={styles.numeric}>{triage.clicks.live}</td>
                  <td className={styles.numeric}>{triage.opens.live}</td>
                  <td className={styles.rowNote} style={{ display: "table-cell" }}>
                    What the headline figures count.
                  </td>
                </tr>
                <tr>
                  <td>− Likely bot</td>
                  <td className={styles.numeric}>{triage.clicks.bot}</td>
                  <td className={styles.numeric}>{triage.opens.bot}</td>
                  <td className={styles.rowNote} style={{ display: "table-cell" }}>
                    Scanner, proxy or automation user agent.
                  </td>
                </tr>
                <tr>
                  <td>
                    − Likely internal
                    <InfoTip topic="internal" />
                  </td>
                  <td className={styles.numeric}>{triage.clicks.internal}</td>
                  <td className={styles.numeric}>{triage.opens.internal}</td>
                  <td className={styles.rowNote} style={{ display: "table-cell" }}>
                    A device that had produced test or pre-send events ({triage.internalDevices} device{triage.internalDevices === 1 ? "" : "s"}).
                  </td>
                </tr>
                <tr>
                  <td>− Scanner echo</td>
                  <td className={styles.numeric}>{triage.clicks.echo}</td>
                  <td className={styles.numeric}>—</td>
                  <td className={styles.rowNote} style={{ display: "table-cell" }}>
                    Same link, seconds apart, different address.
                  </td>
                </tr>
                <tr>
                  <td>− Repeat</td>
                  <td className={styles.numeric}>{triage.clicks.repeat}</td>
                  <td className={styles.numeric}>—</td>
                  <td className={styles.rowNote} style={{ display: "table-cell" }}>
                    Same link, seconds apart, same address.
                  </td>
                </tr>
                <tr className={styles.rowSelected}>
                  <td className={styles.rowHead}>= Genuine</td>
                  <td className={`${styles.numeric} ${styles.rowHead}`}>{triage.clicks.genuine}</td>
                  <td className={`${styles.numeric} ${styles.rowHead}`}>{triage.opens.genuine}</td>
                  <td className={styles.rowNote} style={{ display: "table-cell" }}>
                    Approx. {triage.genuineApproxUniqueClicks} distinct device{triage.genuineApproxUniqueClicks === 1 ? "" : "s"} clicking,{" "}
                    {triage.genuineApproxUniqueOpens} opening. Opens remain estimates.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={styles.sourceLine}>
            Phase comes from each email&rsquo;s status and live-from moment; the
            reason is applied in the order shown, first match wins. Nothing is
            stored — a corrected live-from re-triages history. The CSV export
            carries phase and reason per row.
          </p>
        </section>
      )}

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
                    {collapseEchoes ? "Clicks (collapsed)" : "Clicks"}
                    <InfoTip
                      topic={collapseEchoes ? "collapsedClicks" : "totalClicks"}
                    />
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
                    includeTests={includeTests}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hiddenTestEvents + hiddenPreSendEvents > 0 && (
          <p className={styles.emptyState} style={{ marginTop: "1rem" }}>
            <strong>
              {hiddenTestEvents} test event{hiddenTestEvents === 1 ? "" : "s"}
              {hiddenPreSendEvents > 0 &&
                ` and ${hiddenPreSendEvents} pre-send event${hiddenPreSendEvents === 1 ? "" : "s"}`}{" "}
              recorded for this view — hidden from the figures.
            </strong>{" "}
            Test sends use the <code>-test</code> campaign ID; pre-send events
            are on the live ID before the email went out. Neither counts as
            live.{" "}
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
                  <th className={styles.numeric}>
                    {collapseEchoes ? "Clicks (collapsed)" : "Clicks"}
                  </th>
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
            Latest 50 in this view · {UK_TIME_LABEL}
          </p>
        </div>
        {stats.recentEvents.length === 0 ? (
          <p className={styles.empty}>No events recorded in this view yet.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time ({UK_TIME_LABEL})</th>
                  <th>Type</th>
                  <th>Campaign ID</th>
                  <th>Link ID</th>
                  <th>
                    Location
                    <InfoTip topic="location" />
                  </th>
                  <th>
                    Client
                    <InfoTip topic="clientKind" />
                  </th>
                  <th>
                    Flags
                    <InfoTip topic="echoClusters" label="Flags" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.recentEvents.map((event) => (
                  <tr key={event.id}>
                    <td className={styles.mono}>{formatUkTime(event.createdAt)}</td>
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
                    <td>
                      {event.ipCountry ?? "—"}
                      {event.ipCity ? ` · ${event.ipCity}` : ""}
                    </td>
                    <td>
                      {
                        CLIENT_KIND_LABELS[
                          (event.clientKind as keyof typeof CLIENT_KIND_LABELS) ??
                            "unknown"
                        ] ?? CLIENT_KIND_LABELS.unknown
                      }
                    </td>
                    <td>
                      <span className={styles.flagStack}>
                        {phaseOf(event.campaignId, event.createdAt) !== "live" && (
                          <span
                            className={`${styles.pill} ${
                              phaseOf(event.campaignId, event.createdAt) === "test"
                                ? styles.pillTest
                                : styles.pillInReview
                            }`}
                          >
                            {PHASE_LABELS[phaseOf(event.campaignId, event.createdAt)]}
                          </span>
                        )}
                        {triage?.byId.get(event.id)?.reason === "internal" && (
                          <span
                            className={`${styles.pill} ${styles.pillInReview}`}
                            title={REASON_LABELS.internal}
                          >
                            internal
                          </span>
                        )}
                        {event.isBot && (
                          <span
                            className={`${styles.pill} ${styles.pillPending}`}
                            title={
                              event.botReason
                                ? BOT_REASON_LABELS[event.botReason] ??
                                  event.botReason
                                : "Matched a bot pattern"
                            }
                          >
                            {event.botReason ?? "bot"}
                          </span>
                        )}
                        {stats!.echoEventIds.has(event.id) && (
                          <span className={`${styles.pill} ${styles.roleEcho}`}>
                            echo
                          </span>
                        )}
                        {stats!.repeatEventIds.has(event.id) && (
                          <span
                            className={`${styles.pill} ${styles.roleRepeat}`}
                          >
                            repeat
                          </span>
                        )}
                        {!event.isBot &&
                          !stats!.echoEventIds.has(event.id) &&
                          !stats!.repeatEventIds.has(event.id) &&
                          phaseOf(event.campaignId, event.createdAt) === "live" &&
                          triage?.byId.get(event.id)?.reason !== "internal" &&
                          "—"}
                      </span>
                    </td>
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
  includeTests,
}: {
  row: CampaignRowView;
  selected: boolean;
  includeTests: boolean;
}) {
  const testEvents = row.testMetrics
    ? row.testMetrics.opens + row.testMetrics.clicks
    : 0;
  // With the toggle on, the row's own figures are live-only, so say what the
  // test twin adds — the headline figures include it.
  const testNote =
    includeTests && row.testMetrics
      ? `// plus ${row.testMetrics.opens} test open${row.testMetrics.opens === 1 ? "" : "s"}, ${row.testMetrics.clicks} test click${row.testMetrics.clicks === 1 ? "" : "s"} in the headline figures`
      : testEvents > 0
        ? `// ${testEvents} test event${testEvents === 1 ? "" : "s"} recorded`
        : null;

  return (
    <tr className={selected ? styles.rowSelected : undefined}>
      <td>
        <span className={styles.rowHead}>{row.label}</span>
        {row.notes && <span className={styles.rowNote}>{row.notes}</span>}
      </td>
      <td>
        <span className={styles.mono}>{row.id}</span>
        {testNote && <span className={styles.rowNoteAccent}>{testNote}</span>}
        {row.liveFromMissing && (
          <span className={styles.rowNoteAccent} title="Set liveFrom in src/config/programmes.ts">
            {"// sent without a live-from — pre-send clicks are counting as live"}
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
