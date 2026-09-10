import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, unauthorizedResponse } from "@/lib/auth";
import { getWorldMapPaths } from "@/lib/map";

export const runtime = "nodejs";

/**
 * The projected world map as SVG path strings.
 *
 * Served separately from the dashboard so the ~100 KB of geometry is fetched
 * once and cached by the browser, rather than travelling with every filter
 * change. The geometry itself is public data; the route sits behind sign-in
 * only because everything under /admin does.
 */
export async function GET(request: NextRequest) {
  if (!getUserFromRequest(request)) return unauthorizedResponse();
  return NextResponse.json(getWorldMapPaths(), {
    headers: {
      "Cache-Control": "private, max-age=86400",
    },
  });
}
