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
  const params = parseTrackingParams(request.nextUrl.searchParams);

  console.log(
    `[click] linkId=${linkId} cid=${params.campaignId} destination=${destinationUrl ?? "NONE"}`
  );

  // Unknown link ID — never redirect to a user-supplied URL.
  if (!destinationUrl) {
    console.warn(`[click] unknown link ID "${linkId}" — returning 404`);
    return NextResponse.json(
      { error: "Unknown or unconfigured link ID" },
      { status: 404 }
    );
  }

  // Await the write so it completes before the serverless function is frozen.
  // logEmailEvent swallows its own errors, so a DB failure never blocks the redirect.
  console.log(`[click] logging click event for linkId=${linkId}…`);
  const logged = await logEmailEvent({
    eventType: "click",
    campaignId: params.campaignId,
    recipientToken: params.recipientToken,
    messageId: params.messageId,
    linkId,
    destinationUrl,
    request,
  });
  console.log(
    `[click] db write ${logged ? "succeeded" : "FAILED"} — redirecting to ${destinationUrl}`
  );

  // Immediate redirect for valid link IDs — never show a tracking page.
  return NextResponse.redirect(destinationUrl, 302);
}
