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
import { ECHO_WINDOW_OPTIONS, parseEchoWindow } from "@/lib/duplication";
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
import Collapsible from "@/components/Collapsible";
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

const n = (value: number) => value.toLocaleString("en-GB");

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

    [stats, programmeMetrics, testMetrics, triage] = await Promise.all([
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
    <header className={styles.header} style={{ marginBottom: "1.1rem", paddingBottom: "0.9rem" }}>
      <div>
        <span className={styles.eyebrowLocal}>Fusion Data &amp; AI · Email tracking</span>
        <h1>Campaign tracking repository</h1>
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
  if (params.window) exportSearch.set("window", params.window);
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
  const hiddenTestEvents = includeTests
    ? 0
    : testMetrics.reduce((sum, m) => sum + m.opens + m.clicks, 0);
  const hiddenPreSendEvents =
    includeTests || !triage ? 0 : triage.clicks.preSend + triage.opens.preSend;
  const detectedEchoes = stats.echoEventIds.size;
  const detectedRepeats = stats.repeatEventIds.size;

  const summaryParts = [
    scopeLabel,
    selectedRow ? selectedRow.label : `all ${allRows.length} emails`,
    excludeBots ? "likely bots excluded" : "bots included",
    includeTests ? "test sends included" : "test sends hidden",
    collapseEchoes ? `echoes within ${echoWindowSeconds}s collapsed` : "every click counted",
  ];

  const clicksHint =
    collapseEchoes && stats.collapse
      ? `${stats.collapse.echoEvents} echo${stats.collapse.echoEvents === 1 ? "" : "es"}, ${stats.collapse.repeatEvents} repeat${stats.collapse.repeatEvents === 1 ? "" : "s"} collapsed.`
      : detectedEchoes + detectedRepeats > 0
        ? `${detectedEchoes} likely echo${detectedEchoes === 1 ? "" : "es"}, ${detectedRepeats} repeat${detectedRepeats === 1 ? "" : "s"} — not collapsed.`
        : "Clicks, not clickers.";

  const programmeIndex = scope.programme
    ? PROGRAMMES.findIndex((p) => p.id === scope!.programme!.id)
    : -1;
  const scopeAccent = programmeIndex >= 0 ? accentFor(programmeIndex) : "var(--border)";

  return (
    <div className={styles.page}>
      {header}

      {/* ---- Programme tabs ------------------------------------------------ */}
      <nav className={styles.programmeNav} aria-label="Programme" style={{ marginBottom: "0.9rem" }}>
        <Link
          href={dashboardHref({ ...params, programme: undefined, campaign: undefined })}
          className={`${styles.programmeTab} ${scope.isAllProgrammes ? styles.programmeTabActive : ""}`}
        >
          <span className={styles.programmeTabLabel}>All programmes</span>
          <span className={styles.programmeTabMeta}>
            <span className={styles.programmeTabCount}>{getAllCampaigns().length}</span> emails tracked
          </span>
        </Link>
        {nav.map((item) => {
          const index = PROGRAMMES.findIndex((p) => p.id === item.id);
          const accent = item.isUnassigned ? "var(--text-quaternary)" : accentFor(index);
          const active = scope!.programmeId === item.id && !scope!.isAllProgrammes;
          return (
            <Link
              key={item.id}
              href={dashboardHref({ ...params, programme: item.id, campaign: undefined })}
              className={`${styles.programmeTab} ${active ? styles.programmeTabActive : ""}`}
              style={{ ["--item-accent" as string]: accent }}
            >
              <span className={styles.programmeTabLabel}>{item.label}</span>
              <span className={styles.programmeTabMeta}>
                {item.isUnassigned ? (
                  <>
                    <span className={styles.programmeTabCount}>{item.campaignCount}</span> unrecognised
                  </>
                ) : (
                  <>
                    {item.client} · <span className={styles.programmeTabCount}>{item.campaignCount}</span>{" "}
                    email{item.campaignCount === 1 ? "" : "s"}
                  </>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ---- Sticky controls: every figure-changing choice in one bar -------- */}
      <div className={styles.stickyBar}>
        <form method="get" className={styles.barCard}>
          {scope.programme && <input type="hidden" name="programme" value={scope.programme.id} />}
          {scope.isUnassigned && <input type="hidden" name="programme" value="unassigned" />}
          {query && <input type="hidden" name="q" value={query} />}
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}

          <div className={styles.barRow}>
            <div className={styles.barGroup}>
              <label htmlFor="campaign">{scope.programme ? scope.programme.label : scopeLabel}</label>
              <select id="campaign" name="campaign" defaultValue={scope.selectedCampaignId ?? ""}>
                <option value="">All {allRows.length} emails</option>
                {allRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
              <InfoTip topic="campaignId" label="Focus on one email" />
            </div>

            <span className={styles.barDivider} aria-hidden="true" />

            <span className={styles.barGroup}>
              <input type="checkbox" id="bots" name="bots" value="exclude" defaultChecked={excludeBots} />
              <label htmlFor="bots" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Exclude likely bots
              </label>
              <InfoTip topic="bots" />
            </span>

            <span className={styles.barGroup}>
              <input type="checkbox" id="tests" name="tests" value="include" defaultChecked={includeTests} />
              <label htmlFor="tests" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Show test &amp; pre-send
              </label>
              <InfoTip topic="preSend" />
            </span>

            <span className={styles.barGroup}>
              <input type="checkbox" id="collapse" name="collapse" value="1" defaultChecked={collapseEchoes} />
              <label htmlFor="collapse" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Collapse echoes
              </label>
              <select name="window" aria-label="Echo window in seconds" defaultValue={String(echoWindowSeconds)} className={styles.inlineSelect}>
                {ECHO_WINDOW_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds}s
                  </option>
                ))}
              </select>
              <InfoTip topic="collapsedClicks" />
            </span>

            <div className={styles.barActions}>
              <button type="submit" className={styles.buttonPrimary}>
                Apply
              </button>
              {mayExport ? (
                <a href={exportHref} className={styles.buttonSecondary}>
                  Export CSV
                </a>
              ) : (
                <span className={styles.buttonDisabled} title="The raw event export is limited to administrator accounts.">
                  Export CSV
                </span>
              )}
            </div>
          </div>
          <p className={styles.barSummary}>{`// ${summaryParts.join(" · ")}`}</p>
        </form>
      </div>

      {/* ---- Hidden-data hint: only when there is something hidden ---------- */}
      {hiddenTestEvents + hiddenPreSendEvents > 0 && (
        <div className={styles.hintBar}>
          <strong>
            {n(hiddenTestEvents)} test{hiddenPreSendEvents > 0 ? ` and ${n(hiddenPreSendEvents)} pre-send` : ""} event
            {hiddenTestEvents + hiddenPreSendEvents === 1 ? "" : "s"} hidden.
          </strong>
          <span>Not counted as live — the build team checking links, before or after the -test URLs.</span>
          <Link href={dashboardHref({ ...params, tests: "include" })}>Show them →</Link>
          <InfoTip topic="preSend" />
        </div>
      )}

      {/* ---- Headline figures --------------------------------------------- */}
      <section className={`${styles.statsGrid} ${styles.statsGridTight}`}>
        <div className={styles.statCard} style={{ ["--item-accent" as string]: accentFor(0) }}>
          <span className={styles.statLabel}>
            Total opens
            <InfoTip topic="totalOpens" />
          </span>
          <span className={styles.statValue}>{n(stats.totalOpens)}</span>
          <span className={styles.statHint}>Estimated. Pixel loads, not people.</span>
        </div>
        <div className={styles.statCard} style={{ ["--item-accent" as string]: accentFor(1) }}>
          <span className={styles.statLabel}>
            Approx. unique opens
            <InfoTip topic="approxUnique" />
          </span>
          <span className={styles.statValue}>{n(stats.approximateUniqueOpens)}</span>
          <span className={styles.statHint}>Hashed IP + mail client. Not recipients.</span>
        </div>
        <div className={styles.statCard} style={{ ["--item-accent" as string]: accentFor(2) }}>
          <span className={styles.statLabel}>
            {collapseEchoes ? "Collapsed clicks" : "Total clicks"}
            <InfoTip topic={collapseEchoes ? "collapsedClicks" : "totalClicks"} />
          </span>
          <span className={styles.statValue}>{n(stats.totalClicks)}</span>
          <span className={styles.statHint}>{clicksHint}</span>
        </div>
        <div className={styles.statCard} style={{ ["--item-accent" as string]: accentFor(3) }}>
          <span className={styles.statLabel}>
            Genuine clicks
            <InfoTip topic="triage" />
          </span>
          <span className={styles.statValue}>{triage ? n(triage.clicks.genuine) : "—"}</span>
          <span className={styles.statHint}>
            After triage: not bot, internal, echo or repeat.
          </span>
        </div>
        <div className={styles.statCard} style={{ ["--item-accent" as string]: accentFor(4) }}>
          <span className={styles.statLabel}>
            Clicks per open
            <InfoTip topic="clicksPerOpen" />
          </span>
          <span className={styles.statValue}>{formatClickRate(stats.totalOpens, stats.totalClicks)}</span>
          <span className={styles.statHint}>A rough ratio. Can exceed 100%.</span>
        </div>
      </section>
      <p className={styles.sourceLineTight}>
        {SOURCE_LINE}
        {collapseEchoes && ` Click figures collapse near-simultaneous events on the same link within ${echoWindowSeconds} seconds to one.`}
      </p>

      {/* ---- The emails — always open, this is the repository ------------- */}
      <section className={`${styles.panel} ${styles.panelSpaced}`} style={{ borderLeft: `var(--accent-bar) solid ${scopeAccent}` }}>
        <div className={styles.sectionTitleRow}>
          <div className={styles.sectionTitleGroup}>
            <h2>{scopeLabel}</h2>
            <InfoTip topic="programme" />
          </div>
          <p className={styles.sectionHint}>
            {rows.length === allRows.length
              ? `${allRows.length} email${allRows.length === 1 ? "" : "s"} · ${awaitingSetup} awaiting setup`
              : `${rows.length} of ${allRows.length} shown`}
          </p>
        </div>

        {scope.programme?.description && (
          <p className={styles.programmeDescription} style={{ marginBottom: "0.9rem" }}>
            {scope.programme.description}
          </p>
        )}
        {scope.isUnassigned && (
          <p className={styles.programmeDescription} style={{ marginBottom: "0.9rem" }}>
            Campaign IDs recorded in the data that no programme claims — a typo in a build, a legacy
            send, or a pixel with no ID. Nothing is discarded.
          </p>
        )}

        {allRows.length > 5 && (
          <form method="get" className={styles.listControls}>
            {Object.entries({ programme: params.programme, campaign: params.campaign, bots: params.bots, tests: params.tests, collapse: params.collapse, window: params.window })
              .filter(([, v]) => v)
              .map(([k, v]) => <input key={k} type="hidden" name={k} value={v as string} />)}
            <input id="q" name="q" type="search" defaultValue={query} placeholder="Search emails, IDs or link IDs" aria-label="Search the list" />
            <select name="status" defaultValue={statusFilter ?? ""} aria-label="Status">
              <option value="">Any status</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {CAMPAIGN_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <button type="submit" className={styles.buttonSecondary}>
              Filter list
            </button>
          </form>
        )}

        {rows.length === 0 ? (
          <p className={styles.emptyState}>
            <strong>Nothing matches that filter.</strong> Clear the search box or set status back to Any.
          </p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
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
                    <InfoTip topic={collapseEchoes ? "collapsedClicks" : "totalClicks"} />
                  </th>
                  <th className={styles.numeric}>
                    Clicks/open
                    <InfoTip topic="clicksPerOpen" />
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <WaveRow
                    key={row.id}
                    row={row}
                    selected={scope!.selectedCampaignId === row.id}
                    includeTests={includeTests}
                    focusHref={dashboardHref({ ...params, campaign: row.id })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!hasAnyEvents && (
          <p className={styles.emptyState} style={{ marginTop: "0.9rem" }}>
            <strong>No live events in this view yet.</strong>{" "}
            {hiddenTestEvents + hiddenPreSendEvents > 0
              ? "Test and pre-send activity exists — see the note above."
              : "Expected while emails are in approval or before a first send."}
          </p>
        )}
      </section>

      {/* ---- Everything else: collapsed by default, answer in the header ---- */}
      {triage && (
        <Collapsible
          id="triage"
          title="Click triage"
          accent="var(--accent-teal)"
          summary={
            <>
              <span className={styles.chip}>raw {n(triage.clicks.raw)}</span>
              <span className={styles.chip}>test {n(triage.clicks.test)}</span>
              <span className={styles.chip}>pre-send {n(triage.clicks.preSend)}</span>
              <span className={styles.chip}>live {n(triage.clicks.live)}</span>
              <span className={styles.chip}>bot {n(triage.clicks.bot)}</span>
              <span className={styles.chip}>internal {n(triage.clicks.internal)}</span>
              <span className={styles.chip}>echo {n(triage.clicks.echo)}</span>
              <span className={styles.chip}>repeat {n(triage.clicks.repeat)}</span>
              <span className={`${styles.chip} ${styles.chipStrong}`} style={{ ["--item-accent" as string]: "var(--accent-teal)" }}>
                genuine {n(triage.clicks.genuine)}
              </span>
            </>
          }
          aside={<InfoTip topic="triage" />}
        >
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
                {(
                  [
                    ["Raw events", triage.clicks.raw, triage.opens.raw, "Everything recorded on these campaign IDs and their -test twins.", true],
                    ["− Test", triage.clicks.test, triage.opens.test, "On a -test campaign ID.", false],
                    ["− Pre-send", triage.clicks.preSend, triage.opens.preSend, "On the live ID before the email was sent.", false],
                    ["= Live", triage.clicks.live, triage.opens.live, "What the headline figures count.", true],
                    ["− Likely bot", triage.clicks.bot, triage.opens.bot, "Scanner, proxy or automation user agent.", false],
                    ["− Likely internal", triage.clicks.internal, triage.opens.internal, `A device that had produced test or pre-send events (${triage.internalDevices} device${triage.internalDevices === 1 ? "" : "s"}).`, false],
                    ["− Scanner echo", triage.clicks.echo, null, "Same link, seconds apart, different address.", false],
                    ["− Repeat", triage.clicks.repeat, null, "Same link, seconds apart, same address.", false],
                  ] as [string, number, number | null, string, boolean][]
                ).map(([stage, clicks, opens, meaning, bold]) => (
                  <tr key={stage}>
                    <td className={bold ? styles.rowHead : undefined}>{stage}</td>
                    <td className={styles.numeric}>{n(clicks)}</td>
                    <td className={styles.numeric}>{opens === null ? "—" : n(opens)}</td>
                    <td className={styles.rowNote} style={{ display: "table-cell" }}>{meaning}</td>
                  </tr>
                ))}
                <tr className={styles.rowSelected}>
                  <td className={styles.rowHead}>= Genuine</td>
                  <td className={`${styles.numeric} ${styles.rowHead}`}>{n(triage.clicks.genuine)}</td>
                  <td className={`${styles.numeric} ${styles.rowHead}`}>{n(triage.opens.genuine)}</td>
                  <td className={styles.rowNote} style={{ display: "table-cell" }}>
                    Approx. {n(triage.genuineApproxUniqueClicks)} distinct device{triage.genuineApproxUniqueClicks === 1 ? "" : "s"} clicking, {n(triage.genuineApproxUniqueOpens)} opening. Opens remain estimates.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={styles.sourceLine}>
            Phase from each email&rsquo;s status and live-from; reason applied in the order shown, first match wins. Nothing is stored — a
            corrected live-from re-triages history. The CSV export carries phase and reason per row.{" "}
            <Link href={duplicationHref(params)}>Open the duplication analysis →</Link>
          </p>
        </Collapsible>
      )}

      <Collapsible
        id="links"
        title="Clicks by link"
        accent="var(--accent-cyan)"
        summary={
          stats.clicksByLinkId.length === 0 ? (
            <span className={styles.chip}>no clicks in view</span>
          ) : (
            <>
              {stats.clicksByLinkId.slice(0, 4).map((row) => (
                <span key={row.linkId} className={styles.chip}>
                  {row.linkId} {n(row.count)}
                </span>
              ))}
              {stats.clicksByLinkId.length > 4 && <span className={styles.chip}>+{stats.clicksByLinkId.length - 4} more</span>}
            </>
          )
        }
        aside={<InfoTip topic="linkId" label="Clicks by link" />}
      >
        <div className={styles.twoCol} style={{ marginBottom: 0 }}>
          <div>
            {stats.clicksByLinkId.length === 0 ? (
              <p className={styles.empty}>No clicks recorded in this view yet.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Link ID</th>
                    <th className={styles.numeric}>{collapseEchoes ? "Clicks (collapsed)" : "Clicks"}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.clicksByLinkId.map((row) => (
                    <tr key={row.linkId}>
                      <td className={styles.mono}>{row.linkId}</td>
                      <td className={styles.numeric}>{n(row.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className={styles.sourceLine}>Counts cover only the emails in view. The same link ID can be used in more than one email.</p>
          </div>
          <div>
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
                    <td className={styles.numeric}>{n(row.metrics.approxUniqueOpens)}</td>
                    <td className={styles.numeric}>{n(row.metrics.approxUniqueClicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.sourceLine}>
              Approximate uniques by email. These do not add up to the programme figure — one person who opened two emails counts once in each row and once overall.
            </p>
          </div>
        </div>
      </Collapsible>

      <Collapsible
        id="recent"
        title="Recent events"
        accent="var(--accent-violet)"
        summary={
          <>
            <span className={styles.chip}>latest {n(stats.recentEvents.length)}</span>
            <span className={styles.chip}>{UK_TIME_LABEL}</span>
            {stats.recentEvents[0] && <span className={styles.chip}>last {formatUkTime(stats.recentEvents[0].createdAt)}</span>}
          </>
        }
        aside={<InfoTip topic="recentEvents" />}
      >
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
                {stats.recentEvents.map((event) => {
                  const phase = phaseOf(event.campaignId, event.createdAt);
                  const reason = triage?.byId.get(event.id)?.reason;
                  const isEcho = stats!.echoEventIds.has(event.id);
                  const isRepeat = stats!.repeatEventIds.has(event.id);
                  const plain = !event.isBot && !isEcho && !isRepeat && phase === "live" && reason !== "internal";
                  return (
                    <tr key={event.id}>
                      <td className={styles.mono}>{formatUkTime(event.createdAt)}</td>
                      <td>
                        <span className={event.eventType === "open" ? styles.badgeOpen : styles.badgeClick}>{event.eventType}</span>
                      </td>
                      <td className={styles.mono}>{event.campaignId ?? "—"}</td>
                      <td className={styles.mono}>{event.linkId ?? "—"}</td>
                      <td>
                        {event.ipCountry ?? "—"}
                        {event.ipCity ? ` · ${event.ipCity}` : ""}
                      </td>
                      <td>
                        {CLIENT_KIND_LABELS[(event.clientKind as keyof typeof CLIENT_KIND_LABELS) ?? "unknown"] ?? CLIENT_KIND_LABELS.unknown}
                      </td>
                      <td>
                        <span className={styles.flagStack}>
                          {phase !== "live" && (
                            <span className={`${styles.pill} ${phase === "test" ? styles.pillTest : styles.pillInReview}`}>{PHASE_LABELS[phase]}</span>
                          )}
                          {reason === "internal" && (
                            <span className={`${styles.pill} ${styles.pillInReview}`} title={REASON_LABELS.internal}>
                              internal
                            </span>
                          )}
                          {event.isBot && (
                            <span
                              className={`${styles.pill} ${styles.pillPending}`}
                              title={event.botReason ? BOT_REASON_LABELS[event.botReason] ?? event.botReason : "Matched a bot pattern"}
                            >
                              {event.botReason ?? "bot"}
                            </span>
                          )}
                          {isEcho && <span className={`${styles.pill} ${styles.roleEcho}`}>echo</span>}
                          {isRepeat && <span className={`${styles.pill} ${styles.roleRepeat}`}>repeat</span>}
                          {plain && "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Collapsible>

      <Collapsible
        id="reading"
        title="Before you read these numbers"
        accent="var(--accent-orange)"
        summary={<span className={styles.chip}>opens are estimates · uniques are not people</span>}
        aside={<Link href="/admin/guide">Full guide →</Link>}
      >
        <p className={styles.programmeDescription} style={{ paddingTop: "0.75rem" }}>
          Opens are <strong>estimates</strong>: mail clients block, cache and pre-load tracking pixels, so opens are under-counted and
          over-counted at the same time. Approximate unique counts group by hashed IP address and mail client — a rough de-duplication,{" "}
          <strong>not a count of people</strong>. Clicks are the dependable signal, and <em>Genuine clicks</em> is the dependable click figure:
          it removes test and pre-send activity, likely bots, likely internal devices, scanner echoes and repeats.
        </p>
      </Collapsible>

      <p className={styles.footerSignature}>
        <strong>FUSION</strong> <span>·</span> email link tracking <span>·</span> <strong>INTERNAL</strong>
      </p>
    </div>
  );
}

function WaveRow({
  row,
  selected,
  includeTests,
  focusHref,
}: {
  row: CampaignRowView;
  selected: boolean;
  includeTests: boolean;
  focusHref: string;
}) {
  const testEvents = row.testMetrics ? row.testMetrics.opens + row.testMetrics.clicks : 0;
  const testNote =
    includeTests && row.testMetrics
      ? `// plus ${row.testMetrics.opens} test open${row.testMetrics.opens === 1 ? "" : "s"}, ${row.testMetrics.clicks} test click${row.testMetrics.clicks === 1 ? "" : "s"} in the headline figures`
      : testEvents > 0
        ? `// ${testEvents} test event${testEvents === 1 ? "" : "s"} recorded`
        : null;

  return (
    <tr className={selected ? styles.rowSelected : undefined}>
      <td>
        <Link href={focusHref} className={styles.rowHead} style={{ textDecoration: "none" }} title="Focus the figures on this email">
          {row.label}
        </Link>
        <span className={styles.rowNote}>
          <span className={styles.mono} style={{ fontSize: "0.7rem" }}>{row.id}</span>
        </span>
        {row.notes && <span className={styles.rowNote}>{row.notes}</span>}
        {testNote && <span className={styles.rowNoteAccent}>{testNote}</span>}
        {row.liveFromMissing && (
          <span className={styles.rowNoteAccent} title="Set liveFrom in src/config/programmes.ts">
            {"// sent without a live-from — pre-send clicks are counting as live"}
          </span>
        )}
      </td>
      <td>
        {row.status ? (
          <span className={`${styles.pill} ${STATUS_PILL_CLASS[row.status]}`}>{CAMPAIGN_STATUS_LABELS[row.status]}</span>
        ) : (
          <span className={`${styles.pill} ${styles.pillNone}`}>Not defined</span>
        )}
      </td>
      <td>{row.sendDate ?? "TBC"}</td>
      <td>
        {row.hasTrackedLinks ? (
          <span className={`${styles.pill} ${styles.pillOk}`}>
            {row.linkIds.length} link{row.linkIds.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className={`${styles.pill} ${styles.pillPending}`}>Not set up</span>
        )}
      </td>
      <td className={styles.numeric}>{n(row.metrics.opens)}</td>
      <td className={styles.numeric}>{n(row.metrics.clicks)}</td>
      <td className={styles.numeric}>{formatClickRate(row.metrics.opens, row.metrics.clicks)}</td>
      <td>
        <Link href={`/admin/setup/${encodeURIComponent(row.id)}`} className={styles.linkAction}>
          {row.hasTrackedLinks ? "Pack →" : "Set up →"}
        </Link>
      </td>
    </tr>
  );
}
