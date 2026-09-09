import {
  PROGRAMMES,
  UNASSIGNED_PROGRAMME_ID,
  getLiveWindows,
  getProgrammeById,
  getTestCampaignId,
  getUnassignedCampaignIds,
  isTestCampaignId,
  type CampaignDefinition,
  type CampaignStatus,
  type LiveWindow,
  type Programme,
} from "@/config/programmes";
import { getCampaignLinkIds, getCampaignLinkMap } from "@/config/links";
import type { CampaignMetrics } from "@/lib/dashboard";

export const ZERO_METRICS: Omit<CampaignMetrics, "campaignId"> = {
  opens: 0,
  clicks: 0,
  approxUniqueOpens: 0,
  approxUniqueClicks: 0,
};

export function emptyMetrics(campaignId: string): CampaignMetrics {
  return { campaignId, ...ZERO_METRICS };
}

/** One row in a programme's wave table. */
export interface CampaignRowView {
  id: string;
  label: string;
  status: CampaignStatus | null;
  sendDate: string | null;
  notes?: string;
  /** Link IDs configured for this campaign (empty until the HTML is final). */
  linkIds: string[];
  /** True once the campaign has at least one allowlisted CTA. */
  hasTrackedLinks: boolean;
  /** False when the cid has no entry in campaignLinkDestinations at all. */
  hasLinkMap: boolean;
  /**
   * Sent or closed, but no liveFrom recorded (and not explicitly marked as
   * predating the rule). Pre-send clicks would be counting as live.
   */
  liveFromMissing: boolean;
  metrics: CampaignMetrics;
  /** Metrics recorded against the `-test` twin, if any. */
  testMetrics: CampaignMetrics | null;
}

/** A selectable scope in the dashboard's programme nav. */
export interface ProgrammeNavItem {
  id: string;
  label: string;
  client: string | null;
  campaignCount: number;
  isUnassigned: boolean;
}

/** The resolved filter scope for the current dashboard request. */
export interface ResolvedScope {
  programmeId: string;
  programme: Programme | null;
  isUnassigned: boolean;
  isAllProgrammes: boolean;
  /** Campaign IDs in this programme (live only, in registry order). */
  programmeCampaignIds: string[];
  /** Selected single campaign, or null for the whole programme. */
  selectedCampaignId: string | null;
  /** IDs to hand to the stats layer, honouring the test-data toggle. */
  filterCampaignIds: string[];
  /**
   * Pre-send exclusions for the live IDs in scope. Empty when the test toggle
   * is on, so everything shows; otherwise events before an email's live-from
   * moment (or on an email not yet sent) are kept out of the figures.
   */
  liveWindows: LiveWindow[];
}

export const ALL_PROGRAMMES_ID = "all";

/**
 * Every live (non-test) campaign ID we know about, from config plus anything
 * that has turned up in the database.
 */
export function allLiveCampaignIds(dbCampaignIds: string[]): string[] {
  const ids = new Set<string>();
  for (const programme of PROGRAMMES) {
    for (const campaign of programme.campaigns) ids.add(campaign.id);
  }
  for (const id of dbCampaignIds) ids.add(id);
  return Array.from(ids).filter((id) => !isTestCampaignId(id));
}

function withTestTwins(ids: string[], includeTests: boolean): string[] {
  if (!includeTests) return ids;
  return ids.flatMap((id) => [id, getTestCampaignId(id)]);
}

/** Build the programme nav, appending an "Unassigned" entry when relevant. */
export function buildProgrammeNav(dbCampaignIds: string[]): ProgrammeNavItem[] {
  const items: ProgrammeNavItem[] = PROGRAMMES.map((programme) => ({
    id: programme.id,
    label: programme.label,
    client: programme.client,
    campaignCount: programme.campaigns.length,
    isUnassigned: false,
  }));

  const unassigned = getUnassignedCampaignIds(dbCampaignIds).filter(
    (id) => !isTestCampaignId(id)
  );

  if (unassigned.length > 0) {
    items.push({
      id: UNASSIGNED_PROGRAMME_ID,
      label: "Unassigned",
      client: null,
      campaignCount: unassigned.length,
      isUnassigned: true,
    });
  }

  return items;
}

/** Work out what the current query string means in terms of campaign IDs. */
export function resolveScope(options: {
  programmeId?: string;
  campaignId?: string;
  dbCampaignIds: string[];
  includeTests: boolean;
}): ResolvedScope {
  const { campaignId, dbCampaignIds, includeTests } = options;
  const programmeId = options.programmeId || ALL_PROGRAMMES_ID;

  const isUnassigned = programmeId === UNASSIGNED_PROGRAMME_ID;
  const isAllProgrammes = programmeId === ALL_PROGRAMMES_ID;
  const programme = isUnassigned ? null : getProgrammeById(programmeId);

  let programmeCampaignIds: string[];
  if (isAllProgrammes || (!programme && !isUnassigned)) {
    programmeCampaignIds = allLiveCampaignIds(dbCampaignIds);
  } else if (isUnassigned) {
    programmeCampaignIds = getUnassignedCampaignIds(dbCampaignIds).filter(
      (id) => !isTestCampaignId(id)
    );
  } else {
    programmeCampaignIds = programme!.campaigns.map((campaign) => campaign.id);
  }

  // Ignore a campaign filter that does not belong to the selected programme.
  const selectedCampaignId =
    campaignId && campaignId !== ALL_PROGRAMMES_ID && programmeCampaignIds.includes(campaignId)
      ? campaignId
      : null;

  const baseIds = selectedCampaignId
    ? [selectedCampaignId]
    : programmeCampaignIds;

  return {
    programmeId: programme?.id ?? (isUnassigned ? UNASSIGNED_PROGRAMME_ID : ALL_PROGRAMMES_ID),
    programme,
    isUnassigned,
    isAllProgrammes: isAllProgrammes || (!programme && !isUnassigned),
    programmeCampaignIds,
    selectedCampaignId,
    filterCampaignIds: withTestTwins(baseIds, includeTests),
    liveWindows: includeTests ? [] : getLiveWindows(baseIds),
  };
}

/**
 * Merge campaign config with recorded metrics into table rows.
 * Campaign IDs with no config (the Unassigned bucket) still get a row.
 */
export function buildCampaignRows(options: {
  campaignIds: string[];
  definitions: CampaignDefinition[];
  metricsByCampaign: CampaignMetrics[];
  /** Metrics for `-test` twins, keyed separately so live figures stay clean. */
  testMetricsByCampaign?: CampaignMetrics[];
}): CampaignRowView[] {
  const { campaignIds, definitions, metricsByCampaign } = options;

  const definitionById = new Map(definitions.map((d) => [d.id, d]));
  const metricsById = new Map(metricsByCampaign.map((m) => [m.campaignId, m]));
  const testMetricsById = new Map(
    (options.testMetricsByCampaign ?? []).map((m) => [m.campaignId, m])
  );

  return campaignIds.map((id) => {
    const definition = definitionById.get(id);
    const linkMap = getCampaignLinkMap(id);
    const linkIds = getCampaignLinkIds(id);

    return {
      id,
      label: definition?.label ?? id,
      status: definition?.status ?? null,
      sendDate: definition?.sendDate ?? null,
      notes: definition?.notes,
      linkIds,
      hasTrackedLinks: linkIds.length > 0,
      hasLinkMap: linkMap !== null,
      liveFromMissing:
        definition !== undefined &&
        (definition.status === "sent" || definition.status === "closed") &&
        definition.liveFrom === undefined,
      metrics: metricsById.get(id) ?? emptyMetrics(id),
      testMetrics: testMetricsById.get(getTestCampaignId(id)) ?? null,
    };
  });
}

/** Click-through rate against opens, as a display string. */
export function formatClickRate(opens: number, clicks: number): string {
  if (opens === 0) return "—";
  return `${((clicks / opens) * 100).toFixed(1)}%`;
}
