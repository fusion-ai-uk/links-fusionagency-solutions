import { Prisma } from "@prisma/client";
import { UNKNOWN_CAMPAIGN } from "@/lib/tracking";
import type { LiveWindow } from "@/config/programmes";

export interface DashboardFilters {
  /**
   * Restrict to these campaign IDs (a programme's waves, or a single wave).
   * `null`/`undefined` means no restriction; `[]` means match nothing.
   */
  campaignIds?: string[] | null;
  /** Drop rows flagged by the bot/scanner heuristic. */
  excludeBots?: boolean;
  /**
   * Pre-send exclusion. For each window, rows on that campaign ID before
   * `from` are dropped; `from: null` drops the campaign's rows entirely
   * (not sent yet). Rows on campaigns without a window are untouched.
   */
  liveWindows?: LiveWindow[];
  /** Country codes (ISO alpha-2) and/or "unknown" for rows with no country. */
  countries?: string[] | null;
  /** Half-open time window [from, to). */
  range?: { from: Date | null; to: Date | null } | null;
}

function includesUnknown(campaignIds: string[]): boolean {
  return campaignIds.includes(UNKNOWN_CAMPAIGN);
}

/** Filter for the Prisma query builder (used by the CSV export). */
export function buildEventWhere(
  filters: DashboardFilters
): Prisma.EmailEventWhereInput {
  const where: Prisma.EmailEventWhereInput = {};
  const { campaignIds, excludeBots, liveWindows } = filters;

  if (campaignIds) {
    if (campaignIds.length === 0) {
      where.campaignId = { in: [] };
    } else if (includesUnknown(campaignIds)) {
      where.OR = [{ campaignId: { in: campaignIds } }, { campaignId: null }];
    } else {
      where.campaignId = { in: campaignIds };
    }
  }

  if (excludeBots) {
    where.isBot = false;
  }

  if (filters.countries && filters.countries.length > 0) {
    const codes = filters.countries.filter((c) => c !== "unknown");
    const wantUnknown = filters.countries.includes("unknown");
    const clauses: Prisma.EmailEventWhereInput[] = [];
    if (codes.length > 0) clauses.push({ ipCountry: { in: codes } });
    if (wantUnknown) clauses.push({ ipCountry: null }, { ipCountry: "" });
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { OR: clauses }];
  }

  if (filters.range && (filters.range.from || filters.range.to)) {
    where.createdAt = {
      ...(filters.range.from ? { gte: filters.range.from } : {}),
      ...(filters.range.to ? { lt: filters.range.to } : {}),
    };
  }

  if (liveWindows && liveWindows.length > 0) {
    // NOT as an array: a row must match none of these.
    where.NOT = liveWindows.map((w) =>
      w.from
        ? { campaignId: w.campaignId, createdAt: { lt: w.from } }
        : { campaignId: w.campaignId }
    );
  }

  return where;
}
