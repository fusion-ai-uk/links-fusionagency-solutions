import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAllCampaignIdsInDb } from "@/lib/dashboard";
import {
  clusterClicks,
  ECHO_WINDOW_OPTIONS,
  loadClickClusters,
  parseEchoWindow,
  shortUserAgent,
  summariseClusters,
  type ClickCluster,
  type ClickEvent,
  type ClusterRole,
} from "@/lib/duplication";
import { CLIENT_KIND_LABELS } from "@/lib/request-hints";
import { BOT_REASON_LABELS } from "@/lib/bot-detect";
import {
  getCampaignDefinition,
  PROGRAMMES,
} from "@/config/programmes";
import { ALL_PROGRAMMES_ID, resolveScope } from "@/lib/programme-view";
import { SOURCE_LINE } from "@/config/help";
import { formatUkTime, UK_TIME_LABEL } from "@/lib/time";
import InfoTip from "@/components/InfoTip";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = {
  programme?: string;
  campaign?: string;
  bots?: string;
  tests?: string;
  window?: string;
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

const ROLE_CLASS: Record<ClusterRole, string> = {
  primary: styles.rolePrimary,
  echo: styles.roleEcho,
  repeat: styles.roleRepeat,
};

const MAX_CLUSTERS_SHOWN = 150;

function pct(part: number, whole: number): string {
  if (whole === 0) return "—";
  return `${((part / whole) * 100).toFixed(0)}%`;
}

function fmtTime(date: Date): string {
  return formatUkTime(date);
}

function dashboardHref(params: SearchParams, collapse: boolean): string {
  const search = new URLSearchParams();
  if (params.programme && params.programme !== ALL_PROGRAMMES_ID) {
    search.set("programme", params.programme);
  }
  if (params.campaign) search.set("campaign", params.campaign);
  if (params.bots === "exclude") search.set("bots", "exclude");
  if (params.tests === "include") search.set("tests", "include");
  if (params.window) search.set("window", params.window);
  if (collapse) search.set("collapse", "1");
  const query = search.toString();
  return query ? `/admin?${query}` : "/admin";
}

export default async function DuplicationPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const excludeBots = params.bots === "exclude";
  const includeTests = params.tests === "include";
  const windowSeconds = parseEchoWindow(params.window);

  let clusters: ClickCluster[] = [];
  let scopeLabel = "All programmes";
  let dbError: string | null = null;
  let scopeCampaignIds: string[] = [];

  try {
    const dbCampaignIds = await getAllCampaignIdsInDb();
    const scope = resolveScope({
      programmeId: params.programme,
      campaignId: params.campaign,
      dbCampaignIds,
      includeTests,
    });
    scopeCampaignIds = scope.filterCampaignIds;
    scopeLabel = scope.selectedCampaignId
      ? getCampaignDefinition(scope.selectedCampaignId)?.label ??
        scope.selectedCampaignId
      : scope.programme
        ? scope.programme.label
        : scope.isUnassigned
          ? "Unassigned campaign IDs"
          : "All programmes";

    clusters = await loadClickClusters(
      {
        campaignIds: scope.filterCampaignIds,
        excludeBots,
        liveWindows: scope.liveWindows,
      },
      windowSeconds
    );
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
    console.error("[admin/duplication] query failed:", error);
  }

  const summary = summariseClusters(clusters, windowSeconds);

  // What each window setting would do to the same clicks.
  const allEvents: ClickEvent[] = clusters.flatMap((c) => c.events);
  const byWindow = ECHO_WINDOW_OPTIONS.map((seconds) => ({
    seconds,
    summary: summariseClusters(clusterClicks(allEvents, seconds), seconds),
  }));

  const evidence = clusters
    .filter((c) => c.kind !== "single")
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const shown = evidence.slice(0, MAX_CLUSTERS_SHOWN);

  const multiCampaign = new Set(clusters.map((c) => c.campaignId)).size > 1;
  const hasHintData = allEvents.some((e) => e.clientKind !== null);

  return (
    <div className={styles.page}>
      <Link href={dashboardHref(params, false)} className={styles.backLink}>
        ← Back to the dashboard
      </Link>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrowLocal}>
            {scopeLabel} · duplication analysis
          </span>
          <h1>Where duplicate clicks come from</h1>
          <p className={styles.subtitle}>
            Clicks on the same link within {windowSeconds} seconds of each
            other, grouped, with the most person-like event in each group
            treated as the real click. The evidence for every group is below.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            href={dashboardHref(params, true)}
            className={styles.buttonPrimary}
          >
            Apply collapse on the dashboard
          </Link>
        </div>
      </header>

      {dbError && (
        <div className={styles.errorBanner}>
          <h2>The database cannot be reached</h2>
          <pre className={styles.errorDetail}>{dbError}</pre>
        </div>
      )}

      <div className={styles.notice}>
        <span className={styles.noticeHead}>Three kinds of duplicate</span>
        <strong>Scanner echoes</strong> — the same link fetched twice within
        seconds from two different addresses, typically one in the recipient's
        country and one in a data centre elsewhere. The signature of a
        link-protection layer checking the URL as the recipient clicks it.{" "}
        <strong>Repeat clicks</strong> — the same address clicking the same link
        again within the window. <strong>Approximate-unique drift</strong> — one
        person appearing as several because their address changed, or several
        appearing as one behind a shared network. This page deals with the first
        two; the third is inherent and is why unique counts are labelled
        approximate.
      </div>

      <form method="get" className={styles.filterBar}>
        {params.programme && (
          <input type="hidden" name="programme" value={params.programme} />
        )}
        {params.campaign && (
          <input type="hidden" name="campaign" value={params.campaign} />
        )}
        {excludeBots && <input type="hidden" name="bots" value="exclude" />}
        {includeTests && <input type="hidden" name="tests" value="include" />}
        <div className={styles.filterRow}>
          <div className={styles.filterField}>
            <label className={styles.filterLabel} htmlFor="window">
              Echo window
              <InfoTip topic="echoWindow" />
            </label>
            <select id="window" name="window" defaultValue={String(windowSeconds)}>
              {ECHO_WINDOW_OPTIONS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  within {seconds} seconds
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterActions}>
            <button type="submit" className={styles.buttonPrimary}>
              Apply
            </button>
          </div>
        </div>
        <p className={styles.filterSummary}>
          {`// scope: ${scopeLabel} · ${scopeCampaignIds.length} campaign ID${scopeCampaignIds.length === 1 ? "" : "s"} · ${excludeBots ? "likely bots excluded" : "bots included"} · ${includeTests ? "test sends included" : "test sends hidden"} · window ${windowSeconds}s`}
        </p>
      </form>

      <section className={styles.statsGrid}>
        <div
          className={styles.statCard}
          style={{ ["--item-accent" as string]: "var(--accent-orange)" }}
        >
          <span className={styles.statLabel}>
            Total clicks
            <InfoTip topic="totalClicks" />
          </span>
          <span className={styles.statValue}>
            {summary.totalClicks.toLocaleString("en-GB")}
          </span>
          <span className={styles.statHint}>Every click event in scope.</span>
        </div>
        <div
          className={styles.statCard}
          style={{ ["--item-accent" as string]: "var(--accent-cyan)" }}
        >
          <span className={styles.statLabel}>
            Collapsed clicks
            <InfoTip topic="collapsedClicks" />
          </span>
          <span className={styles.statValue}>
            {summary.collapsedClicks.toLocaleString("en-GB")}
          </span>
          <span className={styles.statHint}>
            One per cluster.{" "}
            {summary.totalClicks - summary.collapsedClicks} removed (
            {pct(summary.totalClicks - summary.collapsedClicks, summary.totalClicks)}
            ).
          </span>
        </div>
        <div
          className={styles.statCard}
          style={{ ["--item-accent" as string]: "var(--accent-teal)" }}
        >
          <span className={styles.statLabel}>
            Scanner echoes
            <InfoTip topic="echoClusters" />
          </span>
          <span className={styles.statValue}>
            {summary.echoEvents.toLocaleString("en-GB")}
          </span>
          <span className={styles.statHint}>
            In {summary.echoClusters + summary.mixedClusters} cluster
            {summary.echoClusters + summary.mixedClusters === 1 ? "" : "s"}.{" "}
            {summary.echoesInDifferentCountry} from a different country to the
            primary.
          </span>
        </div>
        <div
          className={styles.statCard}
          style={{ ["--item-accent" as string]: "var(--accent-violet)" }}
        >
          <span className={styles.statLabel}>
            Repeat clicks
            <InfoTip topic="repeatClicks" />
          </span>
          <span className={styles.statValue}>
            {summary.repeatEvents.toLocaleString("en-GB")}
          </span>
          <span className={styles.statHint}>
            Same address, same link, within the window.
          </span>
        </div>
        <div
          className={styles.statCard}
          style={{ ["--item-accent" as string]: "var(--accent-orange)" }}
        >
          <span className={styles.statLabel}>Echo gap</span>
          <span className={styles.statValue}>
            {summary.echoGapMedianSeconds === null
              ? "—"
              : `${summary.echoGapMedianSeconds.toFixed(1)}s`}
          </span>
          <span className={styles.statHint}>
            Median gap between primary and echo.
            {summary.echoGapMaxSeconds !== null &&
              ` Longest ${summary.echoGapMaxSeconds.toFixed(1)}s.`}
          </span>
        </div>
      </section>

      <p className={styles.sourceLineBlock}>{SOURCE_LINE}</p>

      {summary.echoEvents > 0 && (
        <div className={styles.interpretation}>
          <span className={styles.interpretationLabel}>
            Interpretation — not something the data can prove
          </span>
          {summary.echoesInDifferentCountry} of {summary.echoEvents} echo
          {summary.echoEvents === 1 ? "" : "es"} came from a different country
          to the click they shadow
          {hasHintData &&
            `, and ${summary.echoesWithoutBrowserHints} carried no browser hints at all`}
          . Near-simultaneous fetches of the same link from a second address,
          without the headers a browser sends, are what link-protection
          services produce — Microsoft Defender Safe Links, Proofpoint URL
          Defense, Mimecast and similar all fetch a URL to check it as the
          recipient clicks. <strong>That is the most plausible reading.</strong>{" "}
          It is not a finding: nothing in a request identifies the vendor, and a
          person on a VPN or a phone switching networks can produce the same
          shape.
          {summary.echoesWithoutHintData > 0 &&
            ` ${summary.echoesWithoutHintData} echo${summary.echoesWithoutHintData === 1 ? "" : "es"} predate${summary.echoesWithoutHintData === 1 ? "s" : ""} September 2026, before request hints were captured, so timing and geography are the only evidence for those.`}
        </div>
      )}

      <div className={styles.twoCol}>
        <section className={styles.panel}>
          <div className={styles.sectionTitleRow}>
            <div className={styles.sectionTitleGroup}>
              <h2>What each window would do</h2>
              <InfoTip topic="echoWindow" />
            </div>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Window</th>
                <th className={styles.numeric}>Clusters</th>
                <th className={styles.numeric}>Echoes</th>
                <th className={styles.numeric}>Repeats</th>
                <th className={styles.numeric}>Removed</th>
              </tr>
            </thead>
            <tbody>
              {byWindow.map(({ seconds, summary: s }) => (
                <tr
                  key={seconds}
                  className={seconds === windowSeconds ? styles.rowSelected : ""}
                >
                  <td className={styles.mono}>{seconds}s</td>
                  <td className={styles.numeric}>{s.collapsedClicks}</td>
                  <td className={styles.numeric}>{s.echoEvents}</td>
                  <td className={styles.numeric}>{s.repeatEvents}</td>
                  <td className={styles.numeric}>
                    {s.totalClicks - s.collapsedClicks}{" "}
                    <span className={styles.rowNote} style={{ display: "inline" }}>
                      ({pct(s.totalClicks - s.collapsedClicks, s.totalClicks)})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.sourceLine}>
            If the numbers barely change between windows, the echoes are tightly
            grouped and the default is safe. If they jump at 30s or 60s, look at
            the clusters below before widening — busy moments after a send can
            merge two real people.
          </p>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionTitleRow}>
            <div className={styles.sectionTitleGroup}>
              <h2>Where echoes come from</h2>
              <InfoTip topic="location" />
            </div>
          </div>
          {summary.echoEvents === 0 ? (
            <p className={styles.empty}>No echoes detected in this scope.</p>
          ) : (
            <div className={styles.twoCol} style={{ marginBottom: 0 }}>
              <div>
                <p className={styles.sectionHint} style={{ marginBottom: "0.5rem" }}>
                  Echo side
                </p>
                <table className={styles.table}>
                  <tbody>
                    {summary.echoCountries.slice(0, 8).map((row) => (
                      <tr key={row.country}>
                        <td className={styles.mono}>{row.country}</td>
                        <td className={styles.numeric}>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className={styles.sectionHint} style={{ marginBottom: "0.5rem" }}>
                  Primary side of the same clusters
                </p>
                <table className={styles.table}>
                  <tbody>
                    {summary.primaryCountriesInEchoClusters
                      .slice(0, 8)
                      .map((row) => (
                        <tr key={row.country}>
                          <td className={styles.mono}>{row.country}</td>
                          <td className={styles.numeric}>{row.count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className={styles.sourceLine}>
            Country from the network edge; for proxied requests it is the proxy's
            location, not a person's. That is the point: a data-centre country on
            the echo side is the expected shape.
          </p>
        </section>
      </div>

      <section className={`${styles.panel} ${styles.panelSpaced}`}>
        <div className={styles.sectionTitleRow}>
          <div className={styles.sectionTitleGroup}>
            <h2>Cluster evidence</h2>
            <InfoTip topic="echoClusters" label="Cluster evidence" />
          </div>
          <p className={styles.sectionHint}>
            {evidence.length} cluster{evidence.length === 1 ? "" : "s"} with more
            than one click
            {evidence.length > MAX_CLUSTERS_SHOWN &&
              ` · showing the latest ${MAX_CLUSTERS_SHOWN}`}{" "}
            · {UK_TIME_LABEL}
          </p>
        </div>

        {shown.length === 0 ? (
          <p className={styles.emptyState}>
            <strong>No near-simultaneous clicks in this scope.</strong> Every
            click on every link is at least {windowSeconds} seconds from the
            next. Nothing here would be collapsed.
          </p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.evidenceTable}`}>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Offset</th>
                  <th>Time ({UK_TIME_LABEL})</th>
                  <th>Location</th>
                  <th>
                    Client
                    <InfoTip topic="clientKind" />
                  </th>
                  <th>Browser · OS</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((cluster) => (
                  <ClusterRows
                    key={cluster.key}
                    cluster={cluster}
                    showCampaign={multiCampaign}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.sourceLine}>
          Primary is chosen by: not flagged as a bot, then a browser navigation,
          then the country most of this campaign&rsquo;s browser clicks came
          from, then the later event (scanners tend to fetch first). Echo means
          a different address to the primary; repeat means the same one.
        </p>
      </section>

      <div className={styles.interpretation}>
        <span className={styles.interpretationLabel}>For reporting</span>
        Use collapsed clicks with the default window, exclude likely bots, and
        say so in the source line — for example{" "}
        <em>
          &ldquo;Clicks collapse near-simultaneous events on the same link within
          10 seconds; likely automated traffic excluded.&rdquo;
        </em>{" "}
        Quote the uncollapsed figure alongside if a client has seen it before,
        so the change is explained rather than discovered.
      </div>

      <p className={styles.footerSignature}>
        <strong>FUSION</strong> <span>·</span> duplication analysis{" "}
        <span>·</span> <strong>INTERNAL</strong>
      </p>
    </div>
  );
}

function ClusterRows({
  cluster,
  showCampaign,
}: {
  cluster: ClickCluster;
  showCampaign: boolean;
}) {
  const campaignLabel =
    getCampaignDefinition(cluster.campaignId)?.label ?? cluster.campaignId;
  const programmeLabel = PROGRAMMES.find((p) =>
    p.campaigns.some((c) => c.id === cluster.campaignId)
  )?.label;

  return (
    <>
      <tr className={styles.clusterHead}>
        <td colSpan={7}>
          <strong>{cluster.linkId}</strong>
          {showCampaign && ` · ${programmeLabel ? `${programmeLabel} · ` : ""}${campaignLabel}`}
          {` · ${cluster.events.length} clicks in ${cluster.spanSeconds.toFixed(1)}s · ${cluster.kind}`}
        </td>
      </tr>
      {cluster.events.map((event) => (
        <tr key={event.id}>
          <td>
            <span className={`${styles.pill} ${ROLE_CLASS[event.role]}`}>
              {event.role}
            </span>
          </td>
          <td className={styles.mono}>
            {event.offsetSeconds === 0 ? "0s" : `+${event.offsetSeconds.toFixed(1)}s`}
          </td>
          <td className={styles.mono}>{fmtTime(event.createdAt)}</td>
          <td>
            {event.ipCountry ?? "—"}
            {event.ipCity ? ` · ${event.ipCity}` : event.ipRegion ? ` · ${event.ipRegion}` : ""}
          </td>
          <td>
            {
              CLIENT_KIND_LABELS[
                (event.clientKind as keyof typeof CLIENT_KIND_LABELS) ?? "unknown"
              ] ?? CLIENT_KIND_LABELS.unknown
            }
            {event.secFetchUser === "?1" && (
              <span className={styles.rowNote}>user-activated</span>
            )}
          </td>
          <td title={event.userAgent ?? undefined}>
            {shortUserAgent(event.userAgent)}
          </td>
          <td>
            {event.isBot ? (
              <span
                className={`${styles.pill} ${styles.pillPending}`}
                title={
                  event.botReason
                    ? BOT_REASON_LABELS[event.botReason] ?? event.botReason
                    : undefined
                }
              >
                {event.botReason ?? "bot"}
              </span>
            ) : (
              "—"
            )}
          </td>
        </tr>
      ))}
    </>
  );
}
