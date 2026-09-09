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
}

function includesUnknown(campaignIds: string[]): boolean {
  return campaignIds.includes(UNKNOWN_CAMPAIGN);
}

/** WHERE clause for raw SQL, including the leading `WHERE` (or empty). */
export function buildRawWhere(filters: DashboardFilters): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  const { campaignIds, excludeBots, liveWindows } = filters;

  if (campaignIds) {
    if (campaignIds.length === 0) {
      clauses.push(Prisma.sql`false`);
    } else {
      clauses.push(
        Prisma.sql`COALESCE(campaign_id, ${UNKNOWN_CAMPAIGN}) IN (${Prisma.join(
          campaignIds
        )})`
      );
    }
  }

  if (excludeBots) {
    clauses.push(Prisma.sql`is_bot = false`);
  }

  if (liveWindows && liveWindows.length > 0) {
    const exclusions = liveWindows.map((w) =>
      w.from
        ? Prisma.sql`(campaign_id = ${w.campaignId} AND created_at < ${w.from})`
        : Prisma.sql`(campaign_id = ${w.campaignId})`
    );
    clauses.push(Prisma.sql`NOT (${Prisma.join(exclusions, " OR ")})`);
  }

  if (clauses.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}`;
}

/** Equivalent filter for the Prisma query builder. */
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
