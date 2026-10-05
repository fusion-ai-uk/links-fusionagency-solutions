/**
 * Forwarding campaign parameters through the click redirect.
 *
 * Email links arrive with nothing but our own `cid`. Media links are
 * different: an ad server may append its own campaign parameters or a click
 * ID at serve or click time, and until now the redirect dropped every one of
 * them, because it sent the browser to the stored destination and nothing
 * else. For a partner whose attribution depends on those parameters that is
 * silent data loss.
 *
 * The rules, in order of importance:
 *
 *  1. The stored destination is the certified one. A parameter already on it
 *     is never overwritten, so an ad partner cannot alter a link that a
 *     medical reviewer signed off.
 *  2. Only recognised campaign parameters travel. An allowlist, not a
 *     denylist: anything unrecognised is dropped rather than passed to a
 *     client's landing page.
 *  3. The destination's host and path are untouchable. We only ever add to
 *     the query string, so this cannot become an open redirect.
 *  4. Nothing to add means nothing to change — the original string is
 *     returned untouched rather than reconstructed, so a URL cannot be
 *     silently re-encoded on the way through.
 */

/** Parameter families worth carrying: Google/Matomo/Piwik campaign tagging. */
const FORWARD_PREFIXES = ["utm_", "mtm_", "pk_", "piwik_"];

/** Click identifiers from the common ad platforms, plus TrendMD's. */
const FORWARD_EXACT = new Set([
  "gclid", "gbraid", "wbraid", "dclid", "fbclid", "msclkid", "ttclid",
  "twclid", "li_fat_id", "epik", "s_kwcid", "yclid",
  "trendmd_id", "tmd_click_id", "tmd_id", "clickid", "click_id", "cid_ext",
]);

/** Our own parameters. Never forwarded — they mean something here, not there. */
const RESERVED = new Set(["cid", "rid", "mid"]);

/** Defensive caps: a redirect is not a place to accept unbounded input. */
const MAX_FORWARDED = 12;
const MAX_KEY_LENGTH = 64;
const MAX_VALUE_LENGTH = 512;

/** Control characters have no business in a URL we are about to emit. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function isForwardable(key: string): boolean {
  const k = key.toLowerCase();
  if (RESERVED.has(k)) return false;
  if (k.length === 0 || k.length > MAX_KEY_LENGTH) return false;
  if (FORWARD_EXACT.has(k)) return true;
  return FORWARD_PREFIXES.some((p) => k.startsWith(p) && k.length > p.length);
}

/**
 * Returns the destination with any recognised campaign parameters from the
 * inbound request added to it. Returns the destination unchanged — the very
 * same string — when there is nothing to add.
 */
export function withForwardedParams(
  destination: string,
  incoming: URLSearchParams | null | undefined
): string {
  if (!incoming) return destination;

  // Decide what would be added before touching the destination at all.
  const candidates: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const [key, value] of incoming) {
    if (candidates.length >= MAX_FORWARDED) break;
    if (!isForwardable(key)) continue;
    if (CONTROL_CHARS.test(key) || CONTROL_CHARS.test(value)) continue;
    if (value.length > MAX_VALUE_LENGTH) continue;
    const k = key.toLowerCase();
    if (seen.has(k)) continue; // first occurrence only
    seen.add(k);
    candidates.push([key, value]);
  }
  if (candidates.length === 0) return destination;

  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    // Not a URL we can parse: leave it exactly as configured.
    return destination;
  }

  let added = 0;
  for (const [key, value] of candidates) {
    // Rule 1: the certified link wins. Compared case-insensitively, since
    // query keys are case-sensitive but a near-miss is still a collision.
    const clash = [...url.searchParams.keys()].some(
      (existing) => existing.toLowerCase() === key.toLowerCase()
    );
    if (clash) continue;
    url.searchParams.append(key, value);
    added++;
  }
  if (added === 0) return destination;

  return url.toString();
}

/** Exposed for the test harness and for anyone auditing what travels. */
export const forwardingPolicy = {
  prefixes: FORWARD_PREFIXES,
  exact: [...FORWARD_EXACT],
  reserved: [...RESERVED],
  maxForwarded: MAX_FORWARDED,
  maxKeyLength: MAX_KEY_LENGTH,
  maxValueLength: MAX_VALUE_LENGTH,
};
