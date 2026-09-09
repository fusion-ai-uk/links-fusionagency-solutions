import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/config/users";
import { getAllCampaignIdsInDb } from "@/lib/dashboard";
import { ECHO_WINDOW_OPTIONS, parseEchoWindow } from "@/lib/duplication";
import { CLIENT_KIND_LABELS } from "@/lib/request-hints";
import { BOT_REASON_LABELS } from "@/lib/bot-detect";
import { formatUkDate, formatUkTime, UK_TIME_LABEL } from "@/lib/time";
import { loadConfidence, type ConfidenceInput, type ConfidenceResult, type SendInfo } from "@/lib/confidence";
import { buildTimeline, type TimelineData } from "@/lib/timeline";
import {
  buildView,
  classOf,
  CLASS_META,
  describeClasses,
  EVENT_CLASSES,
  parseClasses,
  serializeClasses,
  type DashboardView,
  type EventClass,
} from "@/lib/view";
import {
  CAMPAIGN_STATUS_LABELS,
  getAllCampaigns,
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
import Icon from "@/components/Icon";
import Collapsible from "@/components/Collapsible";
import FilterBar, { type WaveOption } from "@/components/FilterBar";
import Timeline, { type TimelineOption } from "@/components/Timeline";
import { logoutAction } from "./actions";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = {
  programme?: string;
  campaign?: string | string[];
  include?: string;
  window?: string;
  /** The email shown on the timeline. */
  timeline?: string;
  q?: string;
  status?: string;
  // Older links
  bots?: string;
  tests?: string;
  collapse?: string;
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
const accentFor = (index: number) => ACCENTS[index % ACCENTS.length];

const STATUS_PILL_CLASS: Record<CampaignStatus, string> = {
  planned: styles.pillPlanned,
  "in-review": styles.pillInReview,
  ready: styles.pillReady,
  sent: styles.pillSent,
  closed: styles.pillClosed,
};

const STATUS_ORDER: CampaignStatus[] = ["planned", "in-review", "ready", "sent", "closed"];

const CLASS_PILL: Record<EventClass, string> = {
  confirmed: styles.pillOk,
  echo: styles.roleEcho,
  repeat: styles.roleRepeat,
  internal: styles.pillReady,
  bot: styles.pillPending,
  presend: styles.pillInReview,
  test: styles.pillTest,
};

const n = (value: number) => value.toLocaleString("en-GB");

function asList(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function buildHref(
  base: string,
  parts: {
    programme?: string;
    campaign?: string[];
    include?: string | null;
    window?: string;
    timeline?: string;
    q?: string;
    status?: string;
  }
): string {
  const search = new URLSearchParams();
  if (parts.programme && parts.programme !== ALL_PROGRAMMES_ID) search.set("programme", parts.programme);
  for (const id of parts.campaign ?? []) search.append("campaign", id);
  if (parts.include) search.set("include", parts.include);
  if (parts.window) search.set("window", parts.window);
  if (parts.timeline) search.set("timeline", parts.timeline);
  if (parts.q) search.set("q", parts.q);
  if (parts.status) search.set("status", parts.status);
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const classes = parseClasses(params);
  // Canonical form of the selection for links, so older toggle-style URLs
  // convert to chips on the first navigation.
  const includeParam = serializeClasses(classes) ?? undefined;
  const echoWindowSeconds = parseEchoWindow(params.window);
  const query = (params.q ?? "").trim();
  const statusFilter = STATUS_ORDER.includes(params.status as CampaignStatus)
    ? (params.status as CampaignStatus)
    : null;
  const requestedCampaigns = asList(params.campaign);

  let dbCampaignIds: string[] = [];
  let scope: ReturnType<typeof resolveScope> | null = null;
  let confidence: (ConfidenceResult & { events: ConfidenceInput[] }) | null = null;
  let dbError: string | null = null;

  try {
    dbCampaignIds = await getAllCampaignIdsInDb();
    scope = resolveScope({
      programmeId: params.programme,
      campaignId: requestedCampaigns,
      dbCampaignIds,
      includeTests: true, // the view decides what counts; load everything in scope
    });
    confidence = await loadConfidence(scope.programmeCampaignIds, echoWindowSeconds);
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
    console.error("[admin] dashboard query failed:", error);
  }

  const header = (
    <header className={styles.header} style={{ marginBottom: "1rem", paddingBottom: "0.85rem" }}>
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
          <Icon name="guide" /> How to read this
        </Link>
        <form action={logoutAction}>
          <button type="submit" className={styles.buttonSecondary}>
            Sign out
          </button>
        </form>
      </div>
    </header>
  );

  if (!scope || !confidence) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.errorBanner}>
          <h2>The database cannot be reached</h2>
          <p>
            No figures can be shown while this is the case, and no new opens or clicks are being recorded.
            Nothing already recorded is lost.
          </p>
          <p>
            Check that the Postgres database is active and connected in Vercel (Storage), then redeploy.{" "}
            <code>/health</code> should return <code>{`{"database":"connected","schema":"current"}`}</code>.
          </p>
          {dbError && <pre className={styles.errorDetail}>{dbError}</pre>}
        </div>
      </div>
    );
  }

  const view: DashboardView = buildView({
    events: confidence.events,
    confidence,
    scopeCampaignIds: scope.programmeCampaignIds,
    selectedCampaignIds: scope.selectedCampaignIds,
    classes,
  });

  const nav = buildProgrammeNav(dbCampaignIds);
  const definitions: CampaignDefinition[] = scope.programme ? scope.programme.campaigns : getAllCampaigns();
  const staticRows = buildCampaignRows({
    campaignIds: scope.programmeCampaignIds,
    definitions,
    metricsByCampaign: [],
  });
  const viewByCampaign = new Map(view.campaigns.map((c) => [c.campaignId, c]));

  const lowerQuery = query.toLowerCase();
  const rows = staticRows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (!lowerQuery) return true;
    return (
      row.label.toLowerCase().includes(lowerQuery) ||
      row.id.toLowerCase().includes(lowerQuery) ||
      row.linkIds.some((id) => id.toLowerCase().includes(lowerQuery))
    );
  });

  const scopeLabel = scope.programme
    ? scope.programme.label
    : scope.isUnassigned
      ? "Unassigned campaign IDs"
      : "All programmes";

  const programmeIndex = scope.programme ? PROGRAMMES.findIndex((p) => p.id === scope!.programme!.id) : -1;
  const scopeAccent = programmeIndex >= 0 ? accentFor(programmeIndex) : "var(--border)";

  const waves: WaveOption[] = staticRows.map((row) => ({
    id: row.id,
    label: row.label,
    statusLabel: row.status ? CAMPAIGN_STATUS_LABELS[row.status] : null,
  }));

  const mayExport = can(user.role, "exportCsv");
  const exportIds = scope.selectedCampaignIds.length > 0 ? scope.selectedCampaignIds : scope.programmeCampaignIds;
  const exportHref = mayExport
    ? buildHref("/admin/export.csv", { campaign: exportIds, window: params.window })
    : null;
  const duplicationHref = buildHref("/admin/duplication", {
    programme: scope.programmeId,
    campaign: scope.selectedCampaignIds,
    window: params.window,
  });

  const selectedLabels = staticRows.filter((r) => scope!.selectedCampaignIds.includes(r.id)).map((r) => r.label);
  const summary = [
    scopeLabel,
    selectedLabels.length === 0
      ? `all ${staticRows.length} email${staticRows.length === 1 ? "" : "s"}`
      : selectedLabels.length <= 2
        ? selectedLabels.join(" + ")
        : `${selectedLabels.length} emails`,
    `counting ${describeClasses(classes)}`,
    `${n(view.counted)} of ${n(view.recorded)} events`,
  ].join(" · ");

  const notCounted = view.recorded - view.counted;
  const hiddenClasses = EVENT_CLASSES.filter(
    (c) => !view.classes.has(c) && view.classCounts[c].clicks + view.classCounts[c].opens > 0
  );

  const awaitingSetup = staticRows.filter((row) => !row.hasTrackedLinks).length;
  const hasAnyCounted = view.totalOpens + view.totalClicks > 0;

  // Focusing an email from the table also moves the timeline to it, so the
  // explicit timeline choice is deliberately not carried on these links.
  const rowHref = (id: string) =>
    buildHref("/admin", {
      programme: scope!.programmeId,
      campaign: scope!.selectedCampaignIds.length === 1 && scope!.selectedCampaignIds[0] === id ? [] : [id],
      include: includeParam,
      window: params.window,
    });

  // ---- Timeline: one email at a time ------------------------------------
  // Explicit choice in the URL wins; then a single selected email; then the
  // email in scope with the most recent activity.
  const lastActivity = new Map<string, number>();
  for (const e of confidence.events) {
    const base = e.campaignId ? e.campaignId.replace(/-test$/, "") : "unknown";
    const t = e.createdAt.getTime();
    if ((lastActivity.get(base) ?? 0) < t) lastActivity.set(base, t);
  }
  const timelineId: string | null =
    params.timeline && scope.programmeCampaignIds.includes(params.timeline)
      ? params.timeline
      : scope.selectedCampaignIds.length === 1
        ? scope.selectedCampaignIds[0]
        : [...staticRows].sort((a, b) => (lastActivity.get(b.id) ?? 0) - (lastActivity.get(a.id) ?? 0))[0]?.id ?? null;
  const timelineParam = params.timeline && params.timeline === timelineId ? params.timeline : undefined;

  let timelineData: TimelineData | null = null;
  if (timelineId) {
    const row = staticRows.find((r) => r.id === timelineId);
    const timelineEvents = confidence.events
      .filter((e) => (e.campaignId ? e.campaignId.replace(/-test$/, "") : "unknown") === timelineId)
      .filter((e) => view.classes.has(classOf(confidence!.byId.get(e.id))))
      .map((e) => ({ eventType: e.eventType, createdAt: e.createdAt }));
    timelineData = buildTimeline({
      campaignId: timelineId,
      label: row?.label ?? timelineId,
      events: timelineEvents,
      send: confidence.sends.get(timelineId) ?? null,
      opensByDay: confidence.opensByDay.get(timelineId),
    });
  }
  const timelineOptions: TimelineOption[] = staticRows.map((row) => ({
    id: row.id,
    label: row.label,
    href: buildHref("/admin", {
      programme: scope!.programmeId,
      campaign: scope!.selectedCampaignIds,
      include: includeParam,
      window: params.window,
      timeline: row.id,
      q: query || undefined,
      status: statusFilter ?? undefined,
    }),
  }));
  const detectedSends = staticRows
    .map((row) => confidence!.sends.get(row.id))
    .filter((s): s is SendInfo => s !== undefined && s.source === "detected");

  return (
    <div className={styles.page}>
      {header}

      {/* ---- Programme tabs ------------------------------------------------ */}
      <nav className={styles.programmeNav} aria-label="Programme" style={{ marginBottom: "0.85rem" }}>
        <Link
          href={buildHref("/admin", { include: includeParam, window: params.window })}
          className={`${styles.programmeTab} ${scope.isAllProgrammes ? styles.programmeTabActive : ""}`}
        >
          <span className={styles.programmeTabLabel}>
            <Icon name="layers" /> All programmes
          </span>
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
              href={buildHref("/admin", { programme: item.id, include: includeParam, window: params.window })}
              className={`${styles.programmeTab} ${active ? styles.programmeTabActive : ""}`}
              style={{ ["--item-accent" as string]: accent }}
            >
              <span className={styles.programmeTabLabel}>
                <Icon name={item.isUnassigned ? "warning" : "building"} /> {item.label}
              </span>
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

      {/* ---- Sticky controls ---------------------------------------------- */}
      <div className={styles.stickyBar}>
        <FilterBar
          programme={scope.programmeId}
          scopeLabel={scope.programme ? scope.programme.brand : scopeLabel}
          waves={waves}
          selected={scope.selectedCampaignIds}
          classes={classes}
          classCounts={view.classCounts}
          windowSeconds={echoWindowSeconds}
          windowOptions={ECHO_WINDOW_OPTIONS}
          timeline={timelineParam}
          q={query || undefined}
          status={statusFilter ?? undefined}
          exportHref={exportHref}
          summary={summary}
        />
      </div>

      <div className="results">
        {/* ---- What is not being counted, in one line ---------------------- */}
        {notCounted > 0 && (
          <div className={styles.hintBar}>
            <Icon name="filter" />
            <strong>{n(notCounted)} event{notCounted === 1 ? "" : "s"} not counted</strong>
            <span className={styles.flagStack}>
              {hiddenClasses.map((c) => (
                <span key={c} className={`${styles.pill} ${CLASS_PILL[c]}`}>
                  {CLASS_META[c].label} {n(view.classCounts[c].clicks + view.classCounts[c].opens)}
                </span>
              ))}
            </span>
            <span>Switch a chip on to include it.</span>
            <InfoTip topic="signalFilters" />
          </div>
        )}

        {/* ---- Headline figures --------------------------------------------- */}
        <section className={`${styles.statsGrid} ${styles.statsGridTight}`}>
          <div className={styles.statCard} style={{ ["--item-accent" as string]: accentFor(0) }}>
            <span className={styles.statLabel}>
              Opens
              <InfoTip topic="totalOpens" />
            </span>
            <span className={styles.statValue}>{n(view.totalOpens)}</span>
            <span className={styles.statHint}>Estimated. Pixel loads, not people.</span>
          </div>
          <div className={styles.statCard} style={{ ["--item-accent" as string]: accentFor(1) }}>
            <span className={styles.statLabel}>
              Approx. unique opens
              <InfoTip topic="approxUnique" />
            </span>
            <span className={styles.statValue}>{n(view.approxUniqueOpens)}</span>
            <span className={styles.statHint}>Hashed IP + mail client. Not recipients.</span>
          </div>
          <div className={styles.statCard} style={{ ["--item-accent" as string]: accentFor(2) }}>
            <span className={styles.statLabel}>
              Clicks
              <InfoTip topic="totalClicks" />
            </span>
            <span className={styles.statValue}>{n(view.totalClicks)}</span>
            <span className={styles.statHint}>Counting {describeClasses(classes)}.</span>
          </div>
          <div className={styles.statCard} style={{ ["--item-accent" as string]: accentFor(3) }}>
            <span className={styles.statLabel}>
              Approx. unique clicks
              <InfoTip topic="approxUnique" />
            </span>
            <span className={styles.statValue}>{n(view.approxUniqueClicks)}</span>
            <span className={styles.statHint}>Distinct devices among counted clicks.</span>
          </div>
          <div className={styles.statCard} style={{ ["--item-accent" as string]: "var(--accent-teal)" }}>
            <span className={styles.statLabel}>
              Confirmed clicks
              <InfoTip topic="confidence" />
            </span>
            <span className={styles.statValue}>{n(view.confirmedClicks)}</span>
            <span className={styles.statHint}>
              {view.classes.has("confirmed") && view.classes.size === 1
                ? "This is what the figures show."
                : "Recipients clicking. The figure to report."}
            </span>
          </div>
          <div className={styles.statCard} style={{ ["--item-accent" as string]: accentFor(4) }}>
            <span className={styles.statLabel}>
              Clicks per open
              <InfoTip topic="clicksPerOpen" />
            </span>
            <span className={styles.statValue}>{formatClickRate(view.totalOpens, view.totalClicks)}</span>
            <span className={styles.statHint}>A rough ratio. Can exceed 100%.</span>
          </div>
        </section>
        <p className={styles.sourceLineTight}>
          {SOURCE_LINE} Counting {describeClasses(classes)}
          {!view.classes.has("echo") && !view.classes.has("repeat") && ` — near-simultaneous clicks within ${echoWindowSeconds}s collapsed to one`}.
        </p>

        {/* ---- Timeline ------------------------------------------------------- */}
        <section className={`${styles.panel} ${styles.panelSpaced}`} style={{ borderLeft: "var(--accent-bar) solid var(--accent-cyan)" }}>
          <div className={styles.sectionTitleRow}>
            <div className={styles.sectionTitleGroup}>
              <h2>
                <Icon name="chart" size={16} /> Timeline
              </h2>
              <InfoTip topic="timeline" />
            </div>
            <p className={styles.sectionHint}>
              One email at a time · {UK_TIME_LABEL} · follows the chips
              {detectedSends.length > 0 && (
                <>
                  {" · "}
                  <span style={{ color: "var(--accent-orange)" }}>
                    send detected for {detectedSends.length} email{detectedSends.length === 1 ? "" : "s"}
                  </span>
                  <InfoTip topic="sendDetection" />
                </>
              )}
            </p>
          </div>
          <Timeline data={timelineData} options={timelineOptions} selectedId={timelineId} />
        </section>

        {/* ---- The emails ----------------------------------------------------- */}
        <section className={`${styles.panel} ${styles.panelSpaced}`} style={{ borderLeft: `var(--accent-bar) solid ${scopeAccent}` }}>
          <div className={styles.sectionTitleRow}>
            <div className={styles.sectionTitleGroup}>
              <h2>
                <Icon name="mail" size={16} /> {scopeLabel}
              </h2>
              <InfoTip topic="programme" />
            </div>
            <p className={styles.sectionHint}>
              {rows.length === staticRows.length
                ? `${staticRows.length} email${staticRows.length === 1 ? "" : "s"} · ${awaitingSetup} awaiting setup`
                : `${rows.length} of ${staticRows.length} shown`}
              {scope.selectedCampaignIds.length > 0 && (
                <>
                  {" · "}
                  <Link href={buildHref("/admin", { programme: scope.programmeId, include: includeParam, window: params.window })}>
                    clear selection
                  </Link>
                </>
              )}
            </p>
          </div>

          {scope.programme?.description && (
            <p className={styles.programmeDescription} style={{ marginBottom: "0.9rem" }}>
              {scope.programme.description}
            </p>
          )}
          {scope.isUnassigned && (
            <p className={styles.programmeDescription} style={{ marginBottom: "0.9rem" }}>
              Campaign IDs recorded in the data that no programme claims — a typo in a build, a legacy send, or a
              pixel with no ID. Nothing is discarded.
            </p>
          )}

          {staticRows.length > 5 && (
            <form method="get" className={styles.listControls}>
              {scope.programme && <input type="hidden" name="programme" value={scope.programme.id} />}
              {scope.isUnassigned && <input type="hidden" name="programme" value="unassigned" />}
              {scope.selectedCampaignIds.map((id) => (
                <input key={id} type="hidden" name="campaign" value={id} />
              ))}
              {includeParam && <input type="hidden" name="include" value={includeParam} />}
              {params.window && <input type="hidden" name="window" value={params.window} />}
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
                <Icon name="search" /> Filter list
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
                      Clicks
                      <InfoTip topic="totalClicks" />
                    </th>
                    <th className={styles.numeric}>
                      Confirmed
                      <InfoTip topic="confidence" />
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
                      view={viewByCampaign.get(row.id)}
                      send={confidence!.sends.get(row.id) ?? null}
                      selected={scope!.selectedCampaignIds.includes(row.id)}
                      anySelected={scope!.selectedCampaignIds.length > 0}
                      focusHref={rowHref(row.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!hasAnyCounted && (
            <p className={styles.emptyState} style={{ marginTop: "0.9rem" }}>
              <strong>Nothing counted in this view.</strong>{" "}
              {notCounted > 0
                ? "Events exist but are switched off above — Pre-send and Test are hidden by default."
                : "Expected while emails are in approval or before a first send."}
            </p>
          )}
        </section>

        {/* ---- Collapsibles ---------------------------------------------------- */}
        <Collapsible
          id="confidence"
          title={
            <>
              <Icon name="pulse" /> Click confidence
            </>
          }
          accent="var(--accent-teal)"
          summary={
            <>
              <span className={styles.chip}>raw {n(confidence.clicks.raw)}</span>
              <span className={styles.chip}>live {n(confidence.clicks.live)}</span>
              <span className={styles.chip}>bot {n(confidence.clicks.bot)}</span>
              <span className={styles.chip}>internal {n(confidence.clicks.internal)}</span>
              <span className={styles.chip}>echo {n(confidence.clicks.echo)}</span>
              <span className={styles.chip}>repeat {n(confidence.clicks.repeat)}</span>
              <span className={`${styles.chip} ${styles.chipStrong}`} style={{ ["--item-accent" as string]: "var(--accent-teal)" }}>
                confirmed {n(confidence.clicks.confirmed)}
              </span>
            </>
          }
          aside={<InfoTip topic="confidence" />}
        >
          <p className={styles.sectionHint} style={{ margin: "0.75rem 0" }}>
            Every click in scope, labelled once by how sure we are it was a recipient. Most are confirmed; the rest are shown so they can be set
            aside. The chips in the bar choose which of these rows the figures count.
          </p>
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
                    ["Raw events", confidence.clicks.raw, confidence.opens.raw, "Everything recorded on these campaign IDs and their -test twins.", true],
                    ["− Test", confidence.clicks.test, confidence.opens.test, "On a -test campaign ID.", false],
                    ["− Pre-send", confidence.clicks.preSend, confidence.opens.preSend, "On the live ID before the email was sent.", false],
                    ["= Live", confidence.clicks.live, confidence.opens.live, "The default view counts these.", true],
                    ["− Likely bot", confidence.clicks.bot, confidence.opens.bot, "Scanner, proxy or automation user agent.", false],
                    ["− Likely internal", confidence.clicks.internal, confidence.opens.internal, `A device that had produced test or pre-send events (${confidence.internalDevices} device${confidence.internalDevices === 1 ? "" : "s"}).`, false],
                    ["− Scanner echo", confidence.clicks.echo, null, "Same link, seconds apart, different address.", false],
                    ["− Repeat", confidence.clicks.repeat, null, "Same link, seconds apart, same address.", false],
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
                  <td className={styles.rowHead}>= Confirmed</td>
                  <td className={`${styles.numeric} ${styles.rowHead}`}>{n(confidence.clicks.confirmed)}</td>
                  <td className={`${styles.numeric} ${styles.rowHead}`}>{n(confidence.opens.confirmed)}</td>
                  <td className={styles.rowNote} style={{ display: "table-cell" }}>
                    Approx. {n(confidence.confirmedApproxUniqueClicks)} distinct device{confidence.confirmedApproxUniqueClicks === 1 ? "" : "s"} clicking,{" "}
                    {n(confidence.confirmedApproxUniqueOpens)} opening. Opens remain estimates.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={styles.sourceLine}>
            Phase from each email&rsquo;s status and live-from (or the detected send); labels applied in the order shown, first match wins. Nothing
            is stored — a corrected live-from re-assesses history. The CSV export carries phase and confidence per row.{" "}
            <Link href={duplicationHref}>
              Open the duplication analysis <Icon name="external" size={11} />
            </Link>
          </p>
        </Collapsible>

        <Collapsible
          id="links"
          title={
            <>
              <Icon name="link" /> Clicks by link
            </>
          }
          accent="var(--accent-cyan)"
          summary={
            view.clicksByLink.length === 0 ? (
              <span className={styles.chip}>no counted clicks</span>
            ) : (
              <>
                {view.clicksByLink.slice(0, 4).map((row) => (
                  <span key={row.linkId} className={styles.chip}>
                    {row.linkId} {n(row.count)}
                  </span>
                ))}
                {view.clicksByLink.length > 4 && <span className={styles.chip}>+{view.clicksByLink.length - 4} more</span>}
              </>
            )
          }
          aside={<InfoTip topic="linkId" label="Clicks by link" />}
        >
          <div className={styles.twoCol} style={{ marginBottom: 0, marginTop: "0.75rem" }}>
            <div>
              {view.clicksByLink.length === 0 ? (
                <p className={styles.empty}>No counted clicks in this view.</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Link ID</th>
                      <th className={styles.numeric}>Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.clicksByLink.map((row) => (
                      <tr key={row.linkId}>
                        <td className={styles.mono}>{row.linkId}</td>
                        <td className={styles.numeric}>{n(row.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className={styles.sourceLine}>Counts follow the chips. The same link ID can be used in more than one email.</p>
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
                  {staticRows.map((row) => {
                    const cv = viewByCampaign.get(row.id);
                    return (
                      <tr key={row.id}>
                        <td>{row.label}</td>
                        <td className={styles.numeric}>{n(cv?.approxUniqueOpens ?? 0)}</td>
                        <td className={styles.numeric}>{n(cv?.approxUniqueClicks ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className={styles.sourceLine}>
                Approximate uniques by email. These do not add up to the programme figure — one person who opened two emails counts once in each row
                and once overall.
              </p>
            </div>
          </div>
        </Collapsible>

        <Collapsible
          id="recent"
          title={
            <>
              <Icon name="clock" /> Recent events
            </>
          }
          accent="var(--accent-violet)"
          summary={
            <>
              <span className={styles.chip}>latest {n(view.recent.length)} counted</span>
              <span className={styles.chip}>{UK_TIME_LABEL}</span>
              {view.recent[0] && <span className={styles.chip}>last {formatUkTime(view.recent[0].createdAt)}</span>}
            </>
          }
          aside={<InfoTip topic="recentEvents" />}
        >
          {view.recent.length === 0 ? (
            <p className={styles.empty} style={{ marginTop: "0.75rem" }}>
              No counted events in this view.
            </p>
          ) : (
            <div className={styles.tableScroll} style={{ marginTop: "0.75rem" }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Time ({UK_TIME_LABEL})</th>
                    <th>Type</th>
                    <th>Kind</th>
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
                  </tr>
                </thead>
                <tbody>
                  {view.recent.map((event) => (
                    <tr key={event.id}>
                      <td className={styles.mono}>{formatUkTime(event.createdAt)}</td>
                      <td>
                        <span className={event.eventType === "open" ? styles.badgeOpen : styles.badgeClick}>{event.eventType}</span>
                      </td>
                      <td>
                        <span
                          className={`${styles.pill} ${CLASS_PILL[event.class]}`}
                          title={
                            event.class === "bot" && event.botReason
                              ? BOT_REASON_LABELS[event.botReason] ?? event.botReason
                              : CLASS_META[event.class].short
                          }
                        >
                          {CLASS_META[event.class].label}
                          {event.class === "bot" && event.botReason ? ` · ${event.botReason}` : ""}
                        </span>
                      </td>
                      <td className={styles.mono}>{event.campaignId ?? "—"}</td>
                      <td className={styles.mono}>{event.linkId ?? "—"}</td>
                      <td>
                        {event.ipCountry ?? "—"}
                        {event.ipCity ? ` · ${event.ipCity}` : ""}
                      </td>
                      <td>{CLIENT_KIND_LABELS[(event.clientKind as keyof typeof CLIENT_KIND_LABELS) ?? "unknown"] ?? CLIENT_KIND_LABELS.unknown}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Collapsible>

        <Collapsible
          id="reading"
          title={
            <>
              <Icon name="info" /> Before you read these numbers
            </>
          }
          accent="var(--accent-orange)"
          summary={<span className={styles.chip}>opens are estimates · uniques are not people</span>}
          aside={
            <Link href="/admin/guide">
              Full guide <Icon name="external" size={11} />
            </Link>
          }
        >
          <p className={styles.programmeDescription} style={{ paddingTop: "0.75rem" }}>
            Opens are <strong>estimates</strong>: mail clients block, cache and pre-load tracking pixels, so opens are under-counted and over-counted
            at the same time. Approximate unique counts group by hashed IP address and mail client — a rough de-duplication,{" "}
            <strong>not a count of people</strong>. Clicks are the dependable signal, and <em>Confirmed clicks</em> is the dependable click figure: it
            leaves out test and pre-send activity, likely bots, likely internal devices, scanner echoes and repeats.
          </p>
        </Collapsible>

        <p className={styles.footerSignature}>
          <strong>FUSION</strong> <span>·</span> email link tracking <span>·</span> <strong>INTERNAL</strong>
        </p>
      </div>
    </div>
  );
}

function WaveRow({
  row,
  view,
  send,
  selected,
  anySelected,
  focusHref,
}: {
  row: CampaignRowView;
  view: DashboardView["campaigns"][number] | undefined;
  send: SendInfo | null;
  selected: boolean;
  anySelected: boolean;
  focusHref: string;
}) {
  const byClass = view?.byClass;
  const testEvents = byClass ? byClass.test.clicks + byClass.test.opens : 0;
  const preSendEvents = byClass ? byClass.presend.clicks + byClass.presend.opens : 0;
  const notes: string[] = [];
  if (testEvents > 0) notes.push(`${testEvents} test`);
  if (preSendEvents > 0) notes.push(`${preSendEvents} pre-send`);
  const sendDetected = send?.source === "detected";

  return (
    <tr className={selected ? styles.rowSelected : undefined} style={anySelected && !selected ? { opacity: 0.55 } : undefined}>
      <td>
        <Link href={focusHref} className={styles.rowHead} style={{ textDecoration: "none" }} title={selected ? "Clear this selection" : "Focus the figures on this email"}>
          {selected && <Icon name="check" size={12} style={{ color: "var(--accent-cyan)", marginRight: "0.35rem" }} />}
          {row.label}
        </Link>
        <span className={styles.rowNote}>
          <span className={styles.mono} style={{ fontSize: "0.7rem" }}>
            {row.id}
          </span>
        </span>
        {row.notes && <span className={styles.rowNote}>{row.notes}</span>}
        {notes.length > 0 && <span className={styles.rowNoteAccent}>{`// ${notes.join(" · ")} event${testEvents + preSendEvents === 1 ? "" : "s"} recorded`}</span>}
        {row.liveFromMissing && (
          <span className={styles.rowNoteAccent} title="Set liveFrom in src/config/programmes.ts">
            {"// sent without a live-from — pre-send clicks are counting as live"}
          </span>
        )}
        {sendDetected && send && (
          <span
            className={styles.rowNoteAccent}
            title={`${send.detected?.opensThatDay ?? "50+"} opens on the send day. Counting live from this moment until the send is recorded in config (status sent + liveFrom).`}
          >
            {`// send detected ${formatUkTime(send.at)} ${UK_TIME_LABEL} — live from then; confirm in config`}
          </span>
        )}
      </td>
      <td>
        {row.status ? (
          <span className={`${styles.pill} ${STATUS_PILL_CLASS[row.status]}`}>{CAMPAIGN_STATUS_LABELS[row.status]}</span>
        ) : (
          <span className={`${styles.pill} ${styles.pillNone}`}>Not defined</span>
        )}
        {sendDetected && (
          <>
            {" "}
            <span className={`${styles.pill} ${styles.pillSent}`} title="Detected from a burst of opens; see Send detection">
              <Icon name="send" size={10} /> Send detected
            </span>
          </>
        )}
      </td>
      <td>
        {send ? (
          <span title={`${formatUkTime(send.at)} ${UK_TIME_LABEL} — ${send.source === "config" ? "recorded in config" : "detected from the data"}`}>
            {formatUkDate(send.at)}
            <span className={styles.rowNote}>{send.source === "config" ? "recorded" : "detected"}</span>
          </span>
        ) : (
          row.sendDate ?? "TBC"
        )}
      </td>
      <td>
        {row.hasTrackedLinks ? (
          <span className={`${styles.pill} ${styles.pillOk}`}>
            {row.linkIds.length} link{row.linkIds.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className={`${styles.pill} ${styles.pillPending}`}>Not set up</span>
        )}
      </td>
      <td className={styles.numeric}>{n(view?.opens ?? 0)}</td>
      <td className={styles.numeric}>{n(view?.clicks ?? 0)}</td>
      <td className={styles.numeric}>{n(byClass?.confirmed.clicks ?? 0)}</td>
      <td className={styles.numeric}>{formatClickRate(view?.opens ?? 0, view?.clicks ?? 0)}</td>
      <td>
        <Link href={`/admin/setup/${encodeURIComponent(row.id)}`} className={styles.linkAction}>
          {row.hasTrackedLinks ? "Pack" : "Set up"} <Icon name="external" size={11} />
        </Link>
      </td>
    </tr>
  );
}
