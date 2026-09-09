/**
 * Explanatory copy for the dashboard.
 *
 * One source of truth for every info tooltip and the /admin/guide page, so the
 * caveats stay consistent wherever a figure appears. Written for colleagues who
 * are not analysts: say what the number is, then say what it is not.
 *
 * Keep to the house style — UK English, plain, no overclaiming, and never state
 * a figure as certain when it is an estimate.
 */

export interface HelpEntry {
  /** Heading used on the guide page. */
  label: string;
  /** One or two sentences. Shown in the tooltip. */
  short: string;
  /** Longer explanation, shown on the guide page only. */
  detail?: string[];
}

export const HELP = {
  totalOpens: {
    label: "Total opens",
    short:
      "Every time the tracking pixel loaded. This is an estimate, not a count of people — it under-counts and over-counts at the same time.",
    detail: [
      "An open is recorded when the 1×1 image in the email is requested. That is the only signal available without recipient IDs.",
      "It under-counts because many mail clients block images by default, so a real read can leave no trace at all.",
      "It over-counts because one person reading an email three times is three opens, and because Apple Mail Privacy Protection and Gmail pre-load images through their own servers whether or not anyone has read the message.",
      "Treat opens as a directional signal about reach. Clicks are the stronger evidence of engagement.",
    ],
  },

  totalClicks: {
    label: "Total clicks",
    short:
      "Every time a tracked link was followed. More reliable than opens, because a click needs a deliberate action.",
    detail: [
      "A click is recorded when someone follows one of the tracked links, immediately before they are redirected to the real destination.",
      "Repeat clicks by the same person are all counted, so this is clicks, not clickers.",
      "Only links that have been set up for that email are tracked. Unsubscribe, preference centre and legal links are deliberately never tracked.",
    ],
  },

  approxUnique: {
    label: "Approximate unique",
    short:
      "An attempt to collapse repeats, by counting distinct combinations of hashed IP address and browser/mail client. It is not a count of people and must never be reported as one.",
    detail: [
      "Without recipient IDs we cannot tell two people apart, so this is the closest available proxy: distinct hashed IP plus user agent, within the same email and event type.",
      "It over-counts when one person's address changes — reading on mobile data and then on office wi-fi looks like two different people.",
      "It under-counts when many people share one address, which is normal inside a hospital, a trust or any large office network. A whole department can appear as one.",
      "Use it to sense-check whether a total is driven by a handful of sources or a broad spread. Do not put it in a client report as a recipient number.",
    ],
  },

  clicksPerOpen: {
    label: "Clicks per open",
    short:
      "Total clicks divided by total opens. A rough ratio only — it can legitimately exceed 100%, so it is not a click-through rate.",
    detail: [
      "This is not the click-through rate an email platform would report, because the denominator is estimated opens rather than delivered emails.",
      "It can go above 100%. Clicks almost always register, whereas opens are lost whenever images are blocked, so the denominator is the unreliable half of the sum.",
      "It is useful for comparing emails within the same programme, where the same distortions apply to both. It is not a figure to quote in isolation.",
    ],
  },

  bots: {
    label: "Likely bots and scanners",
    short:
      "Security scanners, link checkers and crawlers request tracking pixels and follow links. We flag them by user agent and never block them.",
    detail: [
      "Corporate mail security commonly opens every email and visits every link before a recipient sees it. That activity is real traffic but it is not a person engaging.",
      "Events are flagged using a list of known bot and scanner user agents. The check is a heuristic: it will miss some and may occasionally flag a genuine client.",
      "Ticking Exclude likely bots removes flagged rows from every figure on screen and from the CSV export. It is off by default so that headline numbers stay comparable with anything reported previously.",
    ],
  },

  testSends: {
    label: "Test sends",
    short:
      "Any campaign ID ending -test. Test traffic is kept out of the live figures unless you ask for it.",
    detail: [
      "Before an email goes out we send test copies internally. Those opens and clicks are real events but they are ours, not the audience's.",
      "A test build points at the same campaign ID with -test on the end. It uses the same tracked destinations, so the test genuinely exercises the live links.",
      "Test data is excluded from every figure by default. Tick Include test sends to see it, for example when confirming a test actually registered.",
    ],
  },

  campaignId: {
    label: "Campaign ID (cid)",
    short:
      "The identifier that ties every event back to one specific email. It appears in the tracking URLs inside that email's HTML.",
    detail: [
      "One email equals one campaign ID. It is set once, embedded in the email HTML, and cannot be changed after the email is sent.",
      "Reporting is grouped by this ID, which is why each email gets its own rather than sharing one across a programme.",
      "If a campaign ID is mistyped during the email build, its events still record — they simply appear under Unassigned rather than against the intended email.",
    ],
  },

  linkId: {
    label: "Link ID",
    short:
      "A short name for one call to action within an email. Clicks are grouped by it, so the names decide how readable the report is.",
    detail: [
      "Each tracked button or link in an email gets its own ID, chosen to describe the call to action — for example watch-the-symposium.",
      "The same link ID may be used in more than one email. Counts shown here are only for the emails in the current view, so switching programme changes them.",
      "Only allowlisted link IDs work. An ID that is not configured returns a not-found page rather than redirecting, which prevents a recipient ever being sent to another brand's content by mistake.",
    ],
  },

  unassigned: {
    label: "Unassigned",
    short:
      "Campaign IDs found in the data that no programme claims. Usually a typo in an email build, a legacy send, or a pixel called without an ID.",
    detail: [
      "This section exists so nothing is silently lost. Any tracking event with an unrecognised ID still records and still shows up here.",
      "unknown means the tracking pixel or link was requested with no campaign ID at all.",
      "If an ID here looks like a near-miss of a real one, the email build most likely carries a typo. Worth checking before the next send in that programme.",
    ],
  },

  status: {
    label: "Status",
    short:
      "Where the email sits in the approval and setup process. Maintained by hand, so it reflects what we know rather than anything automatic.",
    detail: [
      "Planned — the slot is reserved and nothing can be configured yet, because the content has not arrived.",
      "In review — content received, still going through client, medical or legal review.",
      "Ready to send — tracking is configured and the pack has gone to the email build.",
      "Sent — the email has gone out and is collecting data.",
      "Closed — the send is finished and reporting is signed off.",
    ],
  },

  trackedCtas: {
    label: "Tracked CTAs",
    short:
      "How many calls to action in this email have a tracked link configured. Open tracking works without any of this; click tracking does not.",
    detail: [
      "Not set up is the correct and expected state while an email is still in approval.",
      "Until at least one call to action is configured, clicks in that email cannot be attributed to anything.",
      "The pixel is independent. Open tracking starts working the moment the pixel is in the HTML, whether or not any links are set up.",
    ],
  },

  location: {
    label: "Location",
    short:
      "A coarse country, region or city guess from the network the request came from. Often the location of a mail provider's server rather than a person.",
    detail: [
      "Location comes from the edge network handling the request. It is approximate by design.",
      "Where a mail client proxies images, the location reflects that proxy — commonly a data centre in another country entirely.",
      "No exact IP address is ever stored. Addresses are one-way hashed before they reach the database.",
    ],
  },

  recentEvents: {
    label: "Recent events",
    short:
      "The latest 50 individual events in the current view, newest first. Times are UK time (GMT/BST as applicable).",
    detail: [
      "This is the raw feed, useful for confirming that a change has taken effect or that a test has registered.",
      "Every time shown in the interface is UK time. The CSV export keeps timestamps in UTC (ISO 8601 with a Z) because that is unambiguous for analysis.",
      "For anything beyond the latest 50, use the CSV export.",
    ],
  },

  signalFilters: {
    label: "Choosing what counts",
    short:
      "Every event is one of seven kinds. The chips decide which kinds are counted in every figure on the page — totals, per email, per link, the recent list — so the numbers always agree with the chips.",
    detail: [
      "Confirmed, Echo, Repeat, Internal and Bot are the five kinds of live event; Pre-send and Test are activity from before the send. The number on each chip is how many clicks of that kind exist in the current selection.",
      "All live (the default) counts every live event, which matches what was reported before these controls existed. Confirmed only is the figure to put in front of a client. Everything adds test and pre-send activity so a test can be checked.",
      "Turning off Echo and Repeat is exactly what the old Collapse echoes toggle did. Turning off Bot is what Exclude likely bots did. The chips replace both, and can be combined freely.",
      "Changes apply as soon as a chip is clicked; the thin line along the top of the bar shows while the figures update. The address bar always reflects the current choice, so a view can be bookmarked or sent to a colleague.",
    ],
  },

  preSend: {
    label: "What counts as a test",
    short:
      "Two things make an event a test: it was recorded on a -test campaign ID, or it happened on the live campaign ID before the email was actually sent. Neither is ever counted as live.",
    detail: [
      "Test sends use the -test version of the URLs and are always test, whenever they happen.",
      "Pre-send covers everyone checking the live URLs before the send — the build team clicking through the real HTML, for example. An email is not live until its status is Sent and its live-from moment has been recorded; every event on the live campaign ID before that is pre-send.",
      "Both are hidden from the figures by default and shown, labelled, when Include test sends is ticked. The setup page for each email lists them side by side with live activity.",
      "Historic sends that predate this rule have no live-from moment recorded, so everything on them counts as live — the same as before.",
    ],
  },

  internal: {
    label: "Likely internal",
    short:
      "A live click from a device that had earlier produced test or pre-send events — most likely a colleague looking at the live email, not a recipient.",
    detail: [
      "A device is identified by hashed IP address plus mail client, the same combination used for approximate uniques. If it appears on any test or pre-send event in the current view, its later live events are flagged likely internal.",
      "This catches the common case of the build team or the account team opening and clicking the live email once it has gone out.",
      "It is a heuristic. A shared office network can make a genuine recipient look internal if a colleague tested from the same network; the flag is applied, never used to delete anything.",
    ],
  },

  confidence: {
    label: "Click confidence",
    short:
      "How sure we are that a click was a recipient. Every live click gets one label — likely bot, likely internal, scanner echo, repeat, or confirmed — checked in that order. Confirmed means nothing counted against it.",
    detail: [
      "Raw clicks are first split by phase: test, pre-send and live. Only live clicks are assessed.",
      "Bot — the user agent matched a known scanner, proxy or automation pattern. Internal — the device had produced test or pre-send events. Echo — a near-simultaneous click on the same link from a different address. Repeat — the same again from the same address. Confirmed — none of the above.",
      "The order matters: a bot is a bot before it is anything else, and an echo is only looked for among clicks that have already passed the first two checks.",
      "Most clicks are confirmed. The other labels exist so that the handful which are not can be shown and set aside, not to suggest the data is doubtful.",
      "Nothing is stored. Phase and label are recalculated from the rules and the email's live-from moment every time, so a correction re-assesses history consistently. The CSV export carries both columns per row.",
    ],
  },

  sendDetection: {
    label: "Send detection",
    short:
      "Nobody tells the system when an email goes out, so it watches for the moment itself: the first UK day with 50 or more opens is the send day, and the start of that burst is the live-from moment. Recording the send in config confirms it.",
    detail: [
      "Before a send, the live campaign ID sees a trickle of opens from the build team. A send is unmistakable: dozens or hundreds of opens within an hour. The first UK calendar day with at least 50 non-bot opens is taken as the send day.",
      "Within that day, the send moment is the earliest open followed by a burst — at least five more opens within half an hour. Anything on the live ID before that moment is pre-send; everything from it is live. This is what stops the build team's checks on the morning of the send being counted as recipients.",
      "A detected send is used only while the email's status has not yet been moved to Sent. Once the send is recorded in config with its live-from moment, config takes over. Where the two differ, config wins.",
      "Later days that clear the threshold again are marked on the timeline as bursts: a resend, a reminder, or a mail provider pre-fetching images for many inboxes at once. They are shown for interpretation, never acted on.",
      "The threshold is 50 opens by default and can be lowered per email for a small audience.",
    ],
  },

  timeline: {
    label: "Timeline",
    short:
      "Opens and clicks for one email over time, by UK day or by hour. The dashed line marks the send; flags mark later bursts of opens. Follows the chips, so it shows exactly what the figures count.",
    detail: [
      "Bars are opens, read against the left axis. The line is clicks, read against the right axis — clicks are usually a small fraction of opens, so sharing one axis would flatten them to nothing.",
      "By day shows the whole life of the email. By hour zooms to the three days around the send, where the shape of the send itself is visible: the moment it went out, the first hour's spike, and the tail.",
      "The dashed line is the send moment, from config if recorded, otherwise as detected in the data (labelled Detected). A flag on a later day means that day also had 50 or more opens — see Send detection.",
      "The timeline shows one email at a time on purpose. Overlaying emails hides the shape of each; pick the email from the dropdown, or click an email's name in the table.",
      "Hover or tap a bar for the exact figures. The table view underneath gives the same numbers as text.",
    ],
  },

  csvExport: {
    label: "CSV export",
    short:
      "Downloads the individual events behind the current view, with the same programme, bot and test filters applied.",
    detail: [
      "The export always matches what is on screen, so a filtered view gives a filtered file.",
      "It contains hashed IP addresses and full user agent strings. Treat the file as internal, and do not forward it outside Fusion without checking first.",
    ],
  },

  duplication: {
    label: "Why figures repeat and diverge",
    short:
      "The same person can appear several times in the same figure, and the same event can be counted differently in two places. Both are expected.",
    detail: [
      "One person opening an email four times contributes four total opens. Nothing de-duplicates the headline figures, by design — they are event counts.",
      "Approximate unique tries to collapse those repeats but does so imperfectly, so it will rarely equal the number of real people.",
      "Programme-level approximate uniques are not the sum of their emails. Somebody who opened two emails in a programme is one unique at programme level and one in each email, so the parts add up to more than the whole.",
      "A single click also produces no open, and a single open produces no click. The two are recorded independently, so an email can show clicks from someone whose open was never registered.",
      "The Duplication page breaks clicks down into the three patterns we can detect — scanner echoes, repeat clicks and everything else — with the evidence for each.",
    ],
  },

  echoClusters: {
    label: "Scanner echoes",
    short:
      "Two clicks on the same link within seconds, from different addresses — typically one in the recipient's country and one elsewhere. The signature of a link-protection scanner, not two people.",
    detail: [
      "Many organisations route email through a security layer such as Microsoft Defender Safe Links, Proofpoint URL Defense or Mimecast. When a recipient clicks, that layer fetches the link from its own infrastructure to check it, then lets the recipient's browser through. Both requests reach our redirect.",
      "The scanner request usually comes from a data centre — often the US, Ireland or the Netherlands — seconds before or after the recipient's own click from the UK. Because the two arrive from different addresses, the approximate unique measure cannot tell them apart.",
      "We group clicks on the same link that fall within a short window (10 seconds by default), pick the most person-like event in each group as the primary, and label the others. An echo is a non-primary event from a different address.",
      "Naming a specific vendor from the data alone is an interpretation, not a finding. What the data does show is the timing, the geography and whether the request carried browser hints — all of which are on the Duplication page.",
    ],
  },

  repeatClicks: {
    label: "Repeat clicks",
    short:
      "A second click on the same link, from the same address, within the window. Someone clicking again or refreshing — real, but not a new person.",
    detail: [
      "Unlike an echo, a repeat comes from the same hashed address as the primary click. That points to the same device rather than a scanner.",
      "Repeats are collapsed along with echoes when the collapse toggle is on, since either way the link was followed by one person in that moment.",
      "Clicks by the same person minutes or hours apart are deliberately not collapsed. They fall outside the window and are counted as separate engagements, which is what they are.",
    ],
  },

  collapsedClicks: {
    label: "Collapsed clicks",
    short:
      "Clicks counted once per near-simultaneous cluster rather than once per event. Removes scanner echoes and immediate repeats; leaves everything else alone.",
    detail: [
      "When Collapse near-simultaneous echoes is ticked, every click figure on the page — totals, per email, per link — counts clusters instead of events. Approximate unique clicks is recalculated over the primary event of each cluster.",
      "Nothing is deleted or changed in the data. The toggle only changes how the figures are counted, and the CSV export still contains every event.",
      "Collapsed figures are the better basis for a client report. Say so in the source line, including the window used.",
      "The window is a judgement. Too short and slow scanners slip through; too long and two genuine people clicking in the same moment get merged. Ten seconds is a sensible default; the Duplication page shows what each setting would do.",
    ],
  },

  echoWindow: {
    label: "Echo window",
    short:
      "How close together two clicks on the same link must be to count as one. Ten seconds catches most scanner echoes; widen it if the Duplication page shows gaps just outside.",
    detail: [
      "A cluster grows as long as each click is within the window of the previous one, so a chain of three clicks a few seconds apart is one cluster.",
      "At busy moments — right after a send — two real people can click the same link within a few seconds of each other. A wider window makes that false merge more likely. Check the Duplication page before widening it for a report.",
    ],
  },

  clientKind: {
    label: "Client hints",
    short:
      "What the request itself said about where it came from. A browser navigation is the strongest sign of a person; no hints at all is typical of scanners and older mail clients.",
    detail: [
      "Modern browsers attach Sec-Fetch headers to every request. A person clicking a link produces a top-level navigation; a scanner fetching the same link usually sends nothing.",
      "Browser navigation — a real browser loading the page after a click. Image load — a real browser loading the pixel. Other fetch — a browser, but not a navigation, such as a preview or prefetch. No browser hints — none of the headers were present.",
      "Absence of hints is a soft signal. Some legitimate mail clients and older browsers omit them too, so it is weighed alongside timing and geography rather than trusted on its own.",
      "Hints have been captured since September 2026. Earlier rows show Not captured.",
    ],
  },

  programme: {
    label: "Programme",
    short:
      "A client and brand, holding all of that brand's emails. Selecting one narrows every figure on the page to it.",
    detail: [
      "Programmes keep each piece of client work separate, so figures for one brand can never be mixed into another's reporting.",
      "All programmes gives a service-wide view. It is useful for a sense of overall volume and not much else, because it mixes unrelated audiences.",
    ],
  },
} as const satisfies Record<string, HelpEntry>;

export type HelpId = keyof typeof HELP;

/** Order used on the guide page. */
export const GUIDE_ORDER: HelpId[] = [
  "programme",
  "campaignId",
  "signalFilters",
  "status",
  "trackedCtas",
  "totalOpens",
  "totalClicks",
  "approxUnique",
  "clicksPerOpen",
  "timeline",
  "sendDetection",
  "preSend",
  "confidence",
  "internal",
  "duplication",
  "echoClusters",
  "repeatClicks",
  "collapsedClicks",
  "echoWindow",
  "clientKind",
  "bots",
  "testSends",
  "linkId",
  "unassigned",
  "location",
  "recentEvents",
  "csvExport",
];

/**
 * The standing source line for every figure in this dashboard.
 * Per the deck: a number with no source line is not finished.
 */
export const SOURCE_LINE =
  "Source: Fusion Data & AI — 1st-party email tracking activity. " +
  "Opens are estimated; approximate unique counts are a directional " +
  "de-duplication of hashed IP and user agent, not recipient counts.";
