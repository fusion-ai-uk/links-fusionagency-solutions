import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCampaignMetrics, type CampaignMetrics } from "@/lib/dashboard";
import { getCampaignLinkMap } from "@/config/links";
import {
  CAMPAIGN_STATUS_LABELS,
  getCampaignDefinition,
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
import InfoTip from "@/components/InfoTip";
import CopyButton from "../../CopyButton";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

function emptyMetrics(campaignId: string): CampaignMetrics {
  return {
    campaignId,
    opens: 0,
    clicks: 0,
    approxUniqueOpens: 0,
    approxUniqueClicks: 0,
  };
}

function findMetrics(
  metrics: CampaignMetrics[],
  campaignId: string
): CampaignMetrics {
  return (
    metrics.find((m) => m.campaignId === campaignId) ??
    emptyMetrics(campaignId)
  );
}

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

  let metrics = emptyMetrics(campaignId);
  let testMetrics = emptyMetrics(testCampaignId);
  let dbError: string | null = null;

  try {
    const rows = await getCampaignMetrics({
      campaignIds: [campaignId, testCampaignId],
    });
    metrics = findMetrics(rows, campaignId);
    testMetrics = findMetrics(rows, testCampaignId);
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
    console.error("[admin/setup] metrics query failed:", error);
  }

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

  const configExample = `// src/config/links.ts
"${campaignId}": {
  // one entry per call to action in the approved HTML
  "read-more": "https://example.com/landing-page",
  "watch-video": "https://example.com/landing-page#video",
},`;

  const checklist: { done: boolean; text: string }[] = [
    {
      done: definition !== null,
      text: definition
        ? `Campaign ID reserved in the programme registry (${programmeLabel})`
        : "Campaign ID is not in the programme registry — add it to src/config/programmes.ts",
    },
    {
      done: definition ? definition.status !== "planned" : false,
      text: "Final approved HTML received from the client",
    },
    {
      done: linkIds.length > 0,
      text:
        linkIds.length > 0
          ? `${linkIds.length} call${linkIds.length === 1 ? "" : "s"} to action allowlisted in src/config/links.ts`
          : "Calls to action allowlisted in src/config/links.ts (none yet)",
    },
    {
      done: definition
        ? ["ready", "sent", "closed"].includes(definition.status)
        : false,
      text: "Tracking pack handed to the email build",
    },
    {
      done: testMetrics.opens + testMetrics.clicks > 0,
      text: `Test send verified — ${testMetrics.opens} open${
        testMetrics.opens === 1 ? "" : "s"
      } and ${testMetrics.clicks} click${
        testMetrics.clicks === 1 ? "" : "s"
      } recorded against ${testCampaignId}`,
    },
    {
      done: metrics.opens + metrics.clicks > 0,
      text: `Live events received — ${metrics.opens} open${
        metrics.opens === 1 ? "" : "s"
      } and ${metrics.clicks} click${metrics.clicks === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div className={styles.page}>
      <Link href="/admin" className={styles.backLink}>
        ← Back to the dashboard
      </Link>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrowLocal}>
            {programmeLabel} · tracking setup
          </span>
          <h1>{label}</h1>
          <p className={styles.subtitle}>
            Everything the email build needs for this one email: the open
            tracking pixel, the tracked link URLs, and a copy-ready handover
            block.
          </p>
        </div>
      </header>

      {!definition && (
        <div className={styles.warnBanner}>
          <strong>This campaign ID is not in the registry</strong>
          It is not defined in <code>src/config/programmes.ts</code>, which
          usually means a typo somewhere in an email build. The URLs below still
          record events, but they will report under Unassigned rather than
          against a named email.
        </div>
      )}

      {dbError && (
        <div className={styles.warnBanner}>
          <strong>Event counts are unavailable</strong>
          The URLs below come from configuration and remain correct, but the
          live and test counters could not be read: <code>{dbError}</code>
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
            {definition
              ? CAMPAIGN_STATUS_LABELS[definition.status]
              : "Not defined"}
          </span>
        </div>
        <div className={styles.setupMetaItem}>
          <span className={styles.setupMetaLabel}>Send date</span>
          <span className={styles.setupMetaValue}>
            {definition?.sendDate ?? "TBC"}
          </span>
        </div>
        <div className={styles.setupMetaItem}>
          <span className={styles.setupMetaLabel}>
            Tracked CTAs
            <InfoTip topic="trackedCtas" />
          </span>
          <span className={styles.setupMetaValue}>{linkIds.length}</span>
        </div>
        <div className={styles.setupMetaItem}>
          <span className={styles.setupMetaLabel}>Live opens / clicks</span>
          <span className={styles.setupMetaValue}>
            {metrics.opens} / {metrics.clicks}
          </span>
        </div>
        <div className={styles.setupMetaItem}>
          <span className={styles.setupMetaLabel}>
            Test opens / clicks
            <InfoTip topic="testSends" />
          </span>
          <span className={styles.setupMetaValue}>
            {testMetrics.opens} / {testMetrics.clicks}
          </span>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.panelSpaced}`}>
        <div className={styles.sectionTitleRow}>
          <h2>Readiness</h2>
          <p className={styles.sectionHint}>
            Maintained by hand — it reflects what is configured, not what has
            been approved
          </p>
        </div>
        <ul className={styles.checklist}>
          {checklist.map((item, index) => (
            <li key={index}>
              <span
                className={`${styles.checkMark} ${
                  item.done ? styles.checkDone : styles.checkPending
                }`}
                aria-hidden="true"
              >
                {item.done ? "[x]" : "[ ]"}
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {linkIds.length === 0 && (
        <div className={styles.warnBanner}>
          <strong>No calls to action are configured yet</strong>
          This is the expected state while an email is in approval. Open
          tracking works as soon as the pixel is in the HTML. Click tracking
          needs each call to action allowlisted first: add the link IDs and
          their destination URLs to <code>src/config/links.ts</code>, then
          commit and redeploy. An unknown link ID deliberately returns
          not-found rather than redirecting, so a recipient can never be sent to
          another brand&rsquo;s content by mistake.
          <pre className={styles.codeBlock}>
            <code>{configExample}</code>
          </pre>
        </div>
      )}

      <section className={`${styles.panel} ${styles.panelSpaced}`}>
        <div className={styles.codeBlockHeader}>
          <h3>01 · Open tracking pixel</h3>
          <CopyButton value={pixelSnippet} label="Copy pixel" />
        </div>
        <p className={styles.sectionHint}>
          Add once, immediately before <code>&lt;/body&gt;</code>. Opens are
          estimates only.
        </p>
        <pre className={styles.codeBlock}>
          <code>{pixelSnippet}</code>
        </pre>

        <hr className={styles.stepDivider} />

        <div className={styles.codeBlockHeader}>
          <h3>02 · Tracked links</h3>
        </div>
        {linkIds.length === 0 ? (
          <p className={styles.emptyState}>
            <strong>Nothing to hand over yet.</strong> When the approved HTML
            arrives, choose a link ID for each call to action, add it with its
            destination URL to <code>src/config/links.ts</code>, redeploy, and
            this section will generate the exact URLs to use.
          </p>
        ) : (
          <>
            <p className={styles.sectionHint}>
              Replace the <code>href</code> on each matching call to action with
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
                    <th>Tracked URL — use this in the HTML</th>
                    <th>Final destination</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {linkIds.map((linkId) => (
                    <tr key={linkId}>
                      <td className={styles.mono}>{linkId}</td>
                      <td className={styles.mono}>
                        {buildClickUrl(linkId, campaignId)}
                      </td>
                      <td className={styles.mono}>{linkMap?.[linkId]}</td>
                      <td>
                        <CopyButton
                          value={buildAnchorSnippet(linkId, campaignId)}
                          label="Copy anchor"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.sourceLine}>
              Never replace unsubscribe, preference centre, legal or
              adverse-event links, and never add recipient data to a URL.
            </p>
          </>
        )}
      </section>

      <section className={`${styles.panel} ${styles.panelSpaced}`}>
        <div className={styles.codeBlockHeader}>
          <h3>03 · Test before send</h3>
          <CopyButton value={testPixelSnippet} label="Copy test pixel" />
        </div>
        <p className={styles.sectionHint}>
          Point the test build at <code>{testCampaignId}</code>. It uses the
          same destinations, so the test genuinely exercises the live links,
          but the events are recorded separately and stay out of the live
          figures.
        </p>
        <pre className={styles.codeBlock}>
          <code>{`${testPixelSnippet}

${
  linkIds.length > 0
    ? linkIds
        .map((linkId) => buildAnchorSnippet(linkId, testCampaignId, linkId))
        .join("\n")
    : "<!-- no tracked calls to action configured yet -->"
}`}</code>
        </pre>
        <p className={styles.sourceLine}>
          Quick pixel check in a browser:{" "}
          <a
            href={buildPixelUrl(testCampaignId)}
            target="_blank"
            rel="noreferrer"
          >
            {buildPixelUrl(testCampaignId)}
          </a>{" "}
          — it returns a 1×1 image and records one test open.
        </p>
      </section>

      <section className={styles.panel}>
        <div className={styles.codeBlockHeader}>
          <h3>04 · Full handover pack</h3>
          <CopyButton value={handoverText} label="Copy handover pack" />
        </div>
        <p className={styles.sectionHint}>
          Send this to whoever is building the HTML. Check the mapping against
          the approved email first — this is a draft until someone has.
        </p>
        <pre className={styles.codeBlock}>
          <code>{handoverText}</code>
        </pre>
      </section>

      <p className={styles.footerSignature}>
        <strong>FUSION</strong> <span>·</span> {programmeLabel} <span>·</span>{" "}
        <strong>INTERNAL</strong>
      </p>
    </div>
  );
}
