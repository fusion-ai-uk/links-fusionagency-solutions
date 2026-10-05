import { NextRequest, NextResponse } from "next/server";
import { getDestinationUrl } from "@/config/links";
import { logEmailEvent, parseTrackingParams } from "@/lib/tracking";
import { withForwardedParams } from "@/lib/forward-params";

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
  const params = parseTrackingParams(request.nextUrl.searchParams);
  const configuredUrl = getDestinationUrl(linkId, params.campaignId);

  // Media placements arrive with the ad server's own campaign parameters on
  // the query string. Carry the recognised ones through to the destination,
  // which an email link never needs and a text ad depends on. The configured
  // URL still decides where the reader goes; this only adds to its query.
  const destinationUrl = configuredUrl
    ? withForwardedParams(configuredUrl, request.nextUrl.searchParams)
    : null;

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
  const response = NextResponse.redirect(destinationUrl, 302);

  // A click redirect must never be cached. The framework default here is
  // "public, max-age=0, must-revalidate", which lets a shared cache — a CDN,
  // a hospital proxy — store the response. Even with revalidation, a cache
  // that answers on our behalf means a click we never see, and on a media
  // placement the click is the only measure we hold. It would also let a
  // stale destination survive a config change, which is precisely the thing
  // we promise partners they do not need a rebuild for.
  //
  // The open pixel already sets these; the redirect should match it.
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}
