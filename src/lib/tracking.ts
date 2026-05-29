import { prisma } from "@/lib/prisma";
import { getClientIp, hashIp } from "@/lib/ip-hash";
import { getGeoFromHeaders } from "@/lib/geo";
import { isBotUserAgent } from "@/lib/bot-detect";

/** Stored when cid query param is missing — email experience is never blocked. */
export const UNKNOWN_CAMPAIGN = "unknown";

export type TrackingParams = {
  campaignId: string;
  recipientToken: string | null;
  messageId: string | null;
};

/**
 * Resolve campaign ID from cid query param.
 * Returns "unknown" when missing so logging never breaks the pixel/redirect.
 */
export function resolveCampaignId(searchParams: URLSearchParams): string {
  const cid = searchParams.get("cid")?.trim();
  return cid || UNKNOWN_CAMPAIGN;
}

/**
 * Parse tracking query params. cid defaults to "unknown" if absent.
 * rid and mid are optional legacy fields — not required for campaign-level tracking.
 */
export function parseTrackingParams(
  searchParams: URLSearchParams
): TrackingParams {
  return {
    campaignId: resolveCampaignId(searchParams),
    recipientToken: searchParams.get("rid")?.trim() || null,
    messageId: searchParams.get("mid")?.trim() || null,
  };
}

export interface LogEventInput {
  eventType: "open" | "click";
  campaignId: string;
  recipientToken?: string | null;
  messageId?: string | null;
  linkId?: string | null;
  destinationUrl?: string | null;
  request: Request;
}

/**
 * Persist a tracking event. Errors are logged (console.error → Vercel logs) but
 * never propagated, so tracking endpoints always return pixels/redirects even
 * if the DB is down.
 *
 * IMPORTANT: callers must `await` this before returning their response. On
 * Vercel serverless, fire-and-forget promises are killed once the response is
 * sent, which silently drops the DB write.
 *
 * @returns true if the row was written, false if the write failed.
 */
export async function logEmailEvent(input: LogEventInput): Promise<boolean> {
  const {
    request,
    eventType,
    campaignId,
    recipientToken,
    messageId,
    linkId,
    destinationUrl,
  } = input;

  const userAgent = request.headers.get("user-agent");
  const ip = getClientIp(request);
  const geo = getGeoFromHeaders(request);

  try {
    const created = await prisma.emailEvent.create({
      data: {
        eventType,
        campaignId,
        recipientToken: recipientToken ?? null,
        messageId: messageId ?? null,
        linkId: linkId ?? null,
        destinationUrl: destinationUrl ?? null,
        ipHash: hashIp(ip),
        ipCountry: geo.country,
        ipRegion: geo.region,
        ipCity: geo.city,
        userAgent: userAgent ?? null,
        isBot: isBotUserAgent(userAgent),
      },
    });
    console.log(
      `[tracking] wrote ${eventType} event id=${created.id} campaign=${campaignId} link=${linkId ?? "-"}`
    );
    return true;
  } catch (error) {
    console.error(
      `[tracking] FAILED to write ${eventType} event campaign=${campaignId} link=${linkId ?? "-"}:`,
      error
    );
    return false;
  }
}

/** Smallest valid transparent 1×1 GIF (43 bytes). */
export const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export const NO_CACHE_HEADERS: Record<string, string> = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};
