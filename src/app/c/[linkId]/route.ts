import { NextRequest, NextResponse } from "next/server";
import { getDestinationUrl } from "@/config/links";
import { logEmailEvent, parseTrackingParams } from "@/lib/tracking";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ linkId: string }>;
};

/**
 * Click tracking redirect endpoint.
 * GET /c/[linkId]?cid={campaign_id}
 *
 * Destination URLs come only from the allowlisted link map — never from query params.
 * Optional legacy params rid and mid are accepted but not required.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { linkId } = await context.params;
  const destinationUrl = getDestinationUrl(linkId);

  if (!destinationUrl) {
    return NextResponse.json(
      { error: "Unknown or unconfigured link ID" },
      { status: 404 }
    );
  }

  const params = parseTrackingParams(request.nextUrl.searchParams);

  void logEmailEvent({
    eventType: "click",
    campaignId: params.campaignId,
    recipientToken: params.recipientToken,
    messageId: params.messageId,
    linkId,
    destinationUrl,
    request,
  });

  return NextResponse.redirect(destinationUrl, 302);
}
