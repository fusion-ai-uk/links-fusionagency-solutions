import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { describeUserAgent } from "@/lib/campaign-events";
import { getCampaignLinkMap } from "@/config/links";
import {
  CAMPAIGN_STATUS_LABELS,
  getCampaignDefinition,
  getLiveWindow,
  getProgrammeForCampaign,
  getTestCampaignId,
} from "@/config/programmes";
import {
  buildAnchorSnippet,
  buildClickUrl,
  buildHandoverText,
  buildPixelSnippet,
  buildPixelUrl,
} from "@/lib/tracking-urls";
import { formatUkDate, formatUkTime, UK_TIME_LABEL } from "@/lib/time";
import {
  loadConfidence,
  PHASE_LABELS,
  REASON_LABELS,
  type Phase,
  type ConfidenceInput,
  type ConfidenceResult,
} from "@/lib/confidence";
import InfoTip from "@/components/InfoTip";
import CopyButton from "../../CopyButton";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

type PhaseCounts = Record<Phase, number>;
const zero = (): PhaseCounts => ({ test: 0, "pre-send": 0, live: 0 });

const PHASE_PILL: Record<Phase, string> = {
  test: styles.pillTest,
  "pre-send": styles.pillInReview,
  live: styles.pillSent,
};

export default async function CampaignSetupPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/admin/login");
  }

  const { campaignId: rawCampaignId } = await params;
  const campaignId = decodeURIComponent(rawCampaignId);
  const testCampaignId = getTestCampaignId(campaignId);

  const definition = getCampaignDefinition(campaignId);
  const programme = getProgrammeForCampaign(campaignId);
  const linkMap = getCampaignLinkMap(campaignId);
  const linkIds = linkMap ? Object.keys(linkMap).sort() : [];
  const status = definition?.status ?? null;
  const configured = status !== null && ["ready", "sent", "closed"].includes(status);
  const liveWindow = getLiveWindow(campaignId);
  const isSent = status === "sent" || status === "closed";

  let confidence: (ConfidenceResult & { events: ConfidenceInput[] }) | null = null;
  let dbError: string | null = null;
  try {
    confidence = await loadConfidence([campaignId]);
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
    console.error("[admin/setup] confidence query failed:", error);
  }

  // Per-link and pixel counts by phase.
  const opens = zero();
  const clicksByLink = new Map<string, PhaseCounts>();
  const unexpectedLinks = new Set<string>();
  const events = confidence?.events ?? [];
  for (const e of events) {
    const phase = confidence!.byId.get(e.id)?.phase ?? "live";
    if (e.eventType === "open") {
      opens[phase]++;
    } else if (e.linkId) {
      const row = clicksByLink.get(e.linkId) ?? zero();
      row[phase]++;
      clicksByLink.set(e.linkId, row);
      if (!linkIds.includes(e.linkId)) unexpectedLinks.add(e.linkId);
    }
  }
  const testedLinks = linkIds.filter((id) => {
    const c = clicksByLink.get(id);
    return c ? c.test + c["pre-send"] > 0 : false;
  });
  const testOpens = opens.test + opens["pre-send"];
  const testVerified = testOpens > 0 && testedLinks.length === linkIds.length;
  const liveClicks = [...clicksByLink.values()].reduce((s, c) => s + c.live, 0);
  const confirmedClicks = confidence?.clicks.confirmed ?? 0;

  const recent = [...events]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 30);

  const label = definition?.label ?? campaignId;
  const programmeLabel = programme?.label ?? "Unassigned";
  const pixelSnippet = buildPixelSnippet(campaignId);
  const testPixelSnippet = buildPixelSnippet(testCampaignId);
  const handoverText = buildHandoverText({
    campaignLabel: label,
    campaignId,
    programmeLabel,
    linkIds,
    destinations: linkMap ?? {},
  });

  const send = confidence?.sends.get(campaignId) ?? null;
  const sendDetected = send?.source === "detected";
  const liveFromText =
    liveWindow === null
      ? isSent
        ? "no live-from recorded — everything on the live ID counts"
        : "not applicable"
      : liveWindow.from
        ? `${formatUkTime(liveWindow.from)} ${UK_TIME_LABEL}`
        : sendDetected && send
          ? `${formatUkTime(send.at)} ${UK_TIME_LABEL} — detected from ${send.detected?.opensThatDay ?? "50+"} opens that day; confirm in config`
          : "not sent yet — all live-ID events are pre-send";

  // The process, as it actually runs: HTML → Michael → pack → Steve tests → live.
  const steps: { done: boolean; title: string; detail: string }[] = [
    {
      done: status !== null && status !== "planned",
      title: "Final approved HTML received by Michael",
      detail:
        status === "planned" || status === null
          ? "Nothing can be configured until the approved HTML arrives."
          : "The approved build file has been received.",
    },
    {
      done: configured,
      title: "Pixel and tracked links generated, pack handed to Steve",
      detail: configured
        ? `Set up from the final HTML: the open pixel${linkIds.length > 0 ? ` and ${linkIds.length} tracked link${linkIds.length === 1 ? "" : "s"}` : ", with no tracked links in this email"}.`
        : "Done by Michael through Claude Code, from the actual HTML — not in this interface.",
    },
    {
      done: testVerified,
      title: "Test verified",
      detail: testVerified
        ? `Pixel fired${linkIds.length > 0 ? ` and all ${linkIds.length} links clicked` : ""} — on the -test URLs or on the live URLs before send; both count as testing.`
        : `${testOpens} test open${testOpens === 1 ? "" : "s"} so far${linkIds.length > 0 ? `; ${testedLinks.length} of ${linkIds.length} links clicked` : ""}. Clicks on the live URLs before the send count here too.`,
    },
    {
      done: (isSent || sendDetected) && liveClicks + opens.live > 0,
      title: "Live send — confirmed events arriving",
      detail: !isSent && !sendDetected
        ? "Not sent yet. The send is detected automatically from the first burst of opens; Michael then confirms it in config."
        : sendDetected
          ? `Send detected ${liveFromText}. ${opens.live} live open${opens.live === 1 ? "" : "s"}, ${liveClicks} live click${liveClicks === 1 ? "" : "s"} — ${confirmedClicks} confirmed.`
        : `${opens.live} live open${opens.live === 1 ? "" : "s"}, ${liveClicks} live click${liveClicks === 1 ? "" : "s"} — ${confirmedClicks} confirmed. Live from ${liveFromText}.`,
    },
  ];

  return (
    <div className={styles.page}>
      <Link href="/admin" className={styles.backLink}>
        ← Back to the dashboard
      </Link>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrowLocal}>{programmeLabel} · tracking setup</span>
          <h1>{label}</h1>
          <p className={styles.subtitle}>
            The tracking pack for this email, where it is in the process, and
            everything recorded against it — test, pre-send and live, kept apart.
          </p>
        </div>
      </header>

      <div className={styles.notice}>
        <span className={styles.noticeHead}>How set-up works</span>
        Every email is different — some have no calls to action, some have
        several — so tracking is configured from the <strong>final approved
        HTML</strong>, one email at a time. Setup is done by Michael through
        Claude Code, not in this interface, until an automated route exists.
        Anything recorded before the send is marked live — the build team
        clicking through, on either the -test or the live URLs — is{" "}
        <strong>never counted as live</strong>.
      </div>

      {!definition && (
        <div className={styles.warnBanner}>
          <strong>This campaign ID is not in the registry</strong>
          It usually means a typo somewhere in an email build. The URLs below
          still record events, but they report under Unassigned rather than
          against a named email.
        </div>
      )}

      {sendDetected && send && (
        <div className={styles.notice}>
          <div className={styles.noticeHead}>Send detected — {formatUkTime(send.at)} {UK_TIME_LABEL}</div>
          {send.detected?.opensThatDay ?? "50+"} opens landed on the live ID that day, so the send is taken to have begun at the start of that
          burst. Events before it are pre-send; events from it are live. To confirm, Michael sets status <code>sent</code> and{" "}
          <code>liveFrom: &quot;{send.at.toISOString()}&quot;</code> in <code>src/config/programmes.ts</code>.
        </div>
      )}

      {isSent && definition?.liveFrom === undefined && (
        <div className={styles.warnBanner}>
          <strong>Sent, but no live-from moment recorded</strong>
          Until <code>liveFrom</code> is set for this email, every click on its
          live URLs — including the build team&rsquo;s pre-send checks — is being
          counted as live. Michael sets it in <code>src/config/programmes.ts</code>{" "}
          as the moment the send began.
        </div>
      )}

      {dbError && (
        <div className={styles.warnBanner}>
          <strong>Event counts are unavailable</strong>
          The URLs below come from configuration and remain correct, but the
          counters could not be read: <code>{dbError}</code>
        </div>
      )}

      <section className={styles.setupMeta}>
        <div className={styles.setupMetaItem}>
          <span className={styles.setupMetaLabel}>
            Campaign ID
            <InfoTip topic="campaignId" />
          </span>
          <span className={styles.setupMetaValue}>{campaignId}</span>
        </div>
        <div className={styles.setupMetaItem}>
          <span className={styles.setupMetaLabel}>
            Status
            <InfoTip topic="status" />
          </span>
          <span className={styles.setupMetaValue}>
            {status ? CAMPAIGN_STATUS_LABELS[status] : "Not defined"}
          </span>
        </div>
        <div className={styles.setupMetaItem}>
          <span className={styles.setupMetaLabel}>Send date</span>
          <span className={styles.setupMetaValue}>
            {send ? `${formatUkDate(send.at)}${send.source === "detected" ? " (detected)" : ""}` : definition?.sendDate ?? "TBC"}
          </span>
        </div>
        <div className={styles.setupMetaItem}>
          <span className={styles.setupMetaLabel}>
            Live from
            <InfoTip topic="preSend" />
          </span>
          <span className={styles.setupMetaValue} style={{ fontSize: "0.82rem" }}>
            {liveFromText}
          </span>
        </div>
        <div className={styles.setupMetaItem}>
          <span className={styles.setupMetaLabel}>
            Tracked links
            <InfoTip topic="trackedCtas" />
          </span>
          <span className={styles.setupMetaValue}>{linkIds.length}</span>
        </div>
        <div className={styles.setupMetaItem}>
          <span className={styles.setupMetaLabel}>
            Confirmed clicks
            <InfoTip topic="confidence" />
          </span>
          <span className={styles.setupMetaValue}>{confirmedClicks}</span>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.panelSpaced}`}>
        <div className={styles.sectionTitleRow}>
          <h2>Where this email is</h2>
          <p className={styles.sectionHint}>
            Steps 1–2 are set by hand; 3–4 come from the tracking data
          </p>
        </div>
        <ul className={styles.checklist}>
          {steps.map((step, index) => (
            <li key={index}>
              <span
                className={`${styles.checkMark} ${step.done ? styles.checkDone : styles.checkPending}`}
                aria-hidden="true"
              >
                {step.done ? "[x]" : "[ ]"}
              </span>
              <span>
                <span className={styles.rowHead} style={{ fontSize: "0.88rem" }}>
                  {index + 1}. {step.title}
                </span>
                <span className={styles.rowNote}>{step.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${styles.panel} ${styles.panelSpaced}`}>
        <div className={styles.sectionTitleRow}>
          <div className={styles.sectionTitleGroup}>
            <h2>Activity on this email</h2>
            <InfoTip topic="preSend" label="Activity on this email" />
          </div>
          <p className={styles.sectionHint}>
            Test = on <code>{testCampaignId}</code>. Pre-send = on the live ID before
            the send. Only Live counts on the dashboard.
          </p>
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>What</th>
                <th className={styles.numeric}>Test</th>
                <th className={styles.numeric}>Pre-send</th>
                <th className={styles.numeric}>Live</th>
                <th>Tested?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.mono}>open pixel</td>
                <td className={styles.numeric}>{opens.test}</td>
                <td className={styles.numeric}>{opens["pre-send"]}</td>
                <td className={styles.numeric}>{opens.live}</td>
                <td>
                  {testOpens > 0 ? (
                    <span className={`${styles.pill} ${styles.pillOk}`}>Fired</span>
                  ) : (
                    <span className={`${styles.pill} ${styles.pillPending}`}>Not yet</span>
                  )}
                </td>
              </tr>
              {linkIds.map((id) => {
                const c = clicksByLink.get(id) ?? zero();
                const tested = c.test + c["pre-send"] > 0;
                return (
                  <tr key={id}>
                    <td className={styles.mono}>{id}</td>
                    <td className={styles.numeric}>{c.test}</td>
                    <td className={styles.numeric}>{c["pre-send"]}</td>
                    <td className={styles.numeric}>{c.live}</td>
                    <td>
                      {tested ? (
                        <span className={`${styles.pill} ${styles.pillOk}`}>Clicked</span>
                      ) : (
                        <span className={`${styles.pill} ${styles.pillPending}`}>Not yet</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {linkIds.length === 0 && (
          <p className={styles.sourceLine}>
            No tracked links on this email — either the final HTML has not been
            ingested yet, or this email has no calls to action. The pixel alone
            still records opens.
          </p>
        )}

        {unexpectedLinks.size > 0 && (
          <div className={styles.warnBanner} style={{ marginTop: "1rem" }}>
            <strong>Clicks on link IDs this email does not define</strong>
            {[...unexpectedLinks].map((id) => (
              <code key={id} style={{ marginRight: "0.5rem" }}>
                {id}
              </code>
            ))}
            — those returned a not-found page. Check the link IDs in the build
            against the pack below.
          </div>
        )}

        <div className={styles.sectionTitleRow} style={{ marginTop: "1.5rem" }}>
          <div className={styles.sectionTitleGroup}>
            <h3>Recent events</h3>
          </div>
          <p className={styles.sectionHint}>
            Latest {recent.length} of {events.length} · {UK_TIME_LABEL}
          </p>
        </div>

        {recent.length === 0 ? (
          <p className={styles.emptyState}>
            <strong>Nothing recorded against this email yet</strong> — no test,
            pre-send or live events. Once a copy is opened or a tracked link
            clicked, it appears here within a few seconds.
          </p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time ({UK_TIME_LABEL})</th>
                  <th>Phase</th>
                  <th>Type</th>
                  <th>Link ID</th>
                  <th>Location</th>
                  <th>Browser · OS</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((event) => {
                  const t = confidence!.byId.get(event.id);
                  const phase = t?.phase ?? "live";
                  return (
                    <tr key={event.id}>
                      <td className={styles.mono}>{formatUkTime(event.createdAt)}</td>
                      <td>
                        <span className={`${styles.pill} ${PHASE_PILL[phase]}`}>{PHASE_LABELS[phase]}</span>
                      </td>
                      <td>
                        <span className={event.eventType === "open" ? styles.badgeOpen : styles.badgeClick}>
                          {event.eventType}
                        </span>
                      </td>
                      <td className={styles.mono}>{event.linkId ?? "—"}</td>
                      <td>
                        {event.ipCountry ?? "—"}
                        {event.ipCity ? ` · ${event.ipCity}` : ""}
                      </td>
                      <td title={event.userAgent ?? undefined}>{describeUserAgent(event.userAgent)}</td>
                      <td>
                        {t?.reason ? (
                          <span
                            className={`${styles.pill} ${
                              t.reason === "confirmed" ? styles.pillOk : t.reason === "bot" ? styles.pillPending : styles.pillInReview
                            }`}
                          >
                            {REASON_LABELS[t.reason]}
                          </span>
                        ) : (
                          <span className={styles.rowNote} style={{ display: "inline" }}>not live</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {configured ? (
        <>
          <section className={`${styles.panel} ${styles.panelSpaced}`}>
            <div className={styles.codeBlockHeader}>
              <h3>Open tracking pixel</h3>
              <CopyButton value={pixelSnippet} label="Copy pixel" />
            </div>
            <p className={styles.sectionHint}>
              Once, immediately before <code>&lt;/body&gt;</code>. Opens are estimates only.
            </p>
            <pre className={styles.codeBlock}>
              <code>{pixelSnippet}</code>
            </pre>

            {linkIds.length > 0 && (
              <>
                <hr className={styles.stepDivider} />
                <div className={styles.codeBlockHeader}>
                  <h3>Tracked links</h3>
                </div>
                <p className={styles.sectionHint}>
                  The <code>href</code> on each matching call to action becomes
                  the tracked URL. The recipient still ends up at the final
                  destination.
                </p>
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>
                          Link ID
                          <InfoTip topic="linkId" />
                        </th>
                        <th>Tracked URL</th>
                        <th>Final destination</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {linkIds.map((linkId) => (
                        <tr key={linkId}>
                          <td className={styles.mono}>{linkId}</td>
                          <td className={styles.mono}>{buildClickUrl(linkId, campaignId)}</td>
                          <td className={styles.mono}>{linkMap?.[linkId]}</td>
                          <td>
                            <CopyButton value={buildAnchorSnippet(linkId, campaignId)} label="Copy anchor" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <hr className={styles.stepDivider} />
            <div className={styles.codeBlockHeader}>
              <h3>Test version</h3>
              <CopyButton value={testPixelSnippet} label="Copy test pixel" />
            </div>
            <p className={styles.sectionHint}>
              Same URLs with <code>-test</code> on the campaign ID. Results show
              in <em>Activity on this email</em> above. Direct pixel check:{" "}
              <a href={buildPixelUrl(testCampaignId)} target="_blank" rel="noreferrer">
                {buildPixelUrl(testCampaignId)}
              </a>
            </p>
            <pre className={styles.codeBlock}>
              <code>{`${testPixelSnippet}${
                linkIds.length > 0
                  ? "\n\n" + linkIds.map((id) => buildAnchorSnippet(id, testCampaignId, id)).join("\n")
                  : ""
              }`}</code>
            </pre>
          </section>

          <section className={styles.panel}>
            <div className={styles.codeBlockHeader}>
              <h3>Handover pack</h3>
              <CopyButton value={handoverText} label="Copy handover pack" />
            </div>
            <p className={styles.sectionHint}>
              The plain-text version of the pack sent to Steve, generated from
              the same configuration.
            </p>
            <pre className={styles.codeBlock}>
              <code>{handoverText}</code>
            </pre>
          </section>
        </>
      ) : (
        <div className={styles.emptyState}>
          <strong>No tracking pack yet.</strong> The pixel and any tracked links
          are generated from the final approved HTML once it reaches Michael.
          What appears here — and how many links, if any — depends on that email.
        </div>
      )}

      <p className={styles.footerSignature}>
        <strong>FUSION</strong> <span>·</span> {programmeLabel} <span>·</span>{" "}
        <strong>INTERNAL</strong>
      </p>
    </div>
  );
}
