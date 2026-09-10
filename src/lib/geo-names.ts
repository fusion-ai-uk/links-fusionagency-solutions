/**
 * Country and place names for the dashboard.
 *
 * Countries are stored as ISO 3166-1 alpha-2 codes (from Vercel's edge
 * headers). Names come from Intl, so there is no table to maintain. Rows with
 * no country are grouped under the UNKNOWN_COUNTRY token, which is also what
 * the URL carries when "Unknown location" is selected in the filter.
 */

export const UNKNOWN_COUNTRY = "unknown";
export const UNKNOWN_COUNTRY_LABEL = "Unknown location";

const names = new Intl.DisplayNames(["en-GB"], { type: "region", fallback: "code" });

/** "United Kingdom" for "GB"; the code itself when Intl has no name. */
export function countryName(code: string | null | undefined): string {
  if (!code || code === UNKNOWN_COUNTRY) return UNKNOWN_COUNTRY_LABEL;
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return upper;
  try {
    return names.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

/** Normalise a stored country value to the token used in filters and counts. */
export function countryKey(code: string | null | undefined): string {
  const upper = code?.trim().toUpperCase();
  return upper && upper.length > 0 ? upper : UNKNOWN_COUNTRY;
}

/**
 * Vercel percent-encodes city names in its headers ("Milton%20Keynes"). Older
 * rows were stored as received, so decode at display time, tolerantly.
 */
export function placeName(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/** Parse the `country` URL parameter: comma list of codes and/or "unknown". */
export function parseCountries(param: string | string[] | undefined): string[] {
  const raw = Array.isArray(param) ? param.join(",") : param ?? "";
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase() === UNKNOWN_COUNTRY ? UNKNOWN_COUNTRY : trimmed.toUpperCase();
    if (key === UNKNOWN_COUNTRY || /^[A-Z]{2}$/.test(key)) seen.add(key);
  }
  return [...seen].sort((a, b) => (a === UNKNOWN_COUNTRY ? 1 : b === UNKNOWN_COUNTRY ? -1 : a.localeCompare(b)));
}

export function serializeCountries(countries: string[]): string | undefined {
  return countries.length > 0 ? countries.join(",") : undefined;
}
