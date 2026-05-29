import { NextRequest } from "next/server";
import {
  logEmailEvent,
  NO_CACHE_HEADERS,
  parseTrackingParams,
  TRANSPARENT_GIF,
} from "@/lib/tracking";

export const runtime = "nodejs";

/**
 * Open tracking pixel endpoint.
 * GET /o?cid={campaign_id}
 *
 * Optional legacy params rid and mid are accepted but not required.
 */
export async function GET(request: NextRequest) {
  const params = parseTrackingParams(request.nextUrl.searchParams);

  // Await the write so it completes before the serverless function is frozen.
  // logEmailEvent swallows its own errors, so a DB failure never blocks the pixel.
  await logEmailEvent({
    eventType: "open",
    campaignId: params.campaignId,
    recipientToken: params.recipientToken,
    messageId: params.messageId,
    request,
  });

  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: NO_CACHE_HEADERS,
  });
}
