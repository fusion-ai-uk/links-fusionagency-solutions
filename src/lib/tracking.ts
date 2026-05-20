import { prisma } from "@/lib/prisma";
import { getClientIp, hashIp } from "@/lib/ip-hash";
import { getGeoFromHeaders } from "@/lib/geo";
import { isBotUserAgent } from "@/lib/bot-detect";

export type TrackingParams = {
  campaignId: string | null;
  recipientToken: string | null;
  messageId: string | null;
};

/** Parse optional tracking query params — never throws on missing values. */
export function parseTrackingParams(
  searchParams: URLSearchParams
): TrackingParams {
  return {
    campaignId: searchParams.get("cid")?.trim() || null,
    recipientToken: searchParams.get("rid")?.trim() || null,
    messageId: searchParams.get("mid")?.trim() || null,
  };
}

export interface LogEventInput {
  eventType: "open" | "click";
  campaignId?: string | null;
  recipientToken?: string | null;
  messageId?: string | null;
  linkId?: string | null;
  destinationUrl?: string | null;
  request: Request;
}

/**
 * Persist a tracking event. Errors are logged but never propagated to callers
 * so tracking endpoints always return pixels/redirects even if DB is down.
 */
export async function logEmailEvent(input: LogEventInput): Promise<void> {
  const { request, eventType, campaignId, recipientToken, messageId, linkId, destinationUrl } =
    input;

  const userAgent = request.headers.get("user-agent");
  const ip = getClientIp(request);
  const geo = getGeoFromHeaders(request);

  try {
    await prisma.emailEvent.create({
      data: {
        eventType,
        campaignId: campaignId ?? null,
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
  } catch (error) {
    console.error("[tracking] Failed to log event:", error);
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
