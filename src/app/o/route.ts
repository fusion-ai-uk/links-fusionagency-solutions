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
 * GET /o?cid={campaign_id}&rid={recipient_token}&mid={message_id}
 */
export async function GET(request: NextRequest) {
  const params = parseTrackingParams(request.nextUrl.searchParams);

  // Fire-and-forget — pixel must always be returned
  void logEmailEvent({
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
