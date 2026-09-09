/**
 * Request hints that help tell a person's browser from a programmatic fetch.
 *
 * Modern browsers (Chrome 76+, Firefox 90+, Safari 16.4+) attach Sec-Fetch-*
 * headers to every request. A user clicking a link in their mail client
 * produces a top-level navigation:
 *
 *   Sec-Fetch-Mode: navigate   Sec-Fetch-Dest: document   Sec-Fetch-User: ?1
 *
 * Link-protection scanners, link previewers and other programmatic fetchers
 * mostly send none of these. Their absence is a soft signal, not proof — older
 * clients and some mail-app webviews omit them too — which is why the
 * dashboard combines it with timing and geography rather than trusting it alone.
 */

export type ClientKind = "navigation" | "image" | "other" | "none";

export interface RequestHints {
  acceptLanguage: string | null;
  acceptHeader: string | null;
  secFetchMode: string | null;
  secFetchDest: string | null;
  secFetchUser: string | null;
  secFetchSite: string | null;
  clientKind: ClientKind;
}

const MAX_HEADER_LENGTH = 200;

function header(request: Request, name: string): string | null {
  const value = request.headers.get(name);
  if (!value) return null;
  return value.length > MAX_HEADER_LENGTH
    ? value.slice(0, MAX_HEADER_LENGTH)
    : value;
}

export function classifyClientKind(hints: {
  secFetchMode: string | null;
  secFetchDest: string | null;
}): ClientKind {
  const { secFetchMode, secFetchDest } = hints;
  if (!secFetchMode && !secFetchDest) return "none";
  if (secFetchDest === "image") return "image";
  if (secFetchMode === "navigate" && secFetchDest === "document") {
    return "navigation";
  }
  return "other";
}

export function getRequestHints(request: Request): RequestHints {
  const secFetchMode = header(request, "sec-fetch-mode");
  const secFetchDest = header(request, "sec-fetch-dest");

  return {
    acceptLanguage: header(request, "accept-language"),
    acceptHeader: header(request, "accept"),
    secFetchMode,
    secFetchDest,
    secFetchUser: header(request, "sec-fetch-user"),
    secFetchSite: header(request, "sec-fetch-site"),
    clientKind: classifyClientKind({ secFetchMode, secFetchDest }),
  };
}

export const CLIENT_KIND_LABELS: Record<ClientKind | "unknown", string> = {
  navigation: "Browser navigation",
  image: "Image load",
  other: "Other fetch",
  none: "No browser hints",
  unknown: "Not captured",
};

export const CLIENT_KIND_DESCRIPTIONS: Record<ClientKind | "unknown", string> = {
  navigation:
    "A top-level page navigation from a real browser — the strongest sign a person followed the link.",
  image:
    "An image request from a real browser, as when a webmail client renders the pixel.",
  other:
    "A browser sent hints, but not for a navigation — a prefetch, preview or embedded fetch.",
  none:
    "No Sec-Fetch headers at all. Typical of link scanners and older mail clients; a soft signal only.",
  unknown: "Recorded before request hints were captured (September 2026).",
};
