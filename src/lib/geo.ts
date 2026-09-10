/**
 * Coarse geo location from Vercel edge headers (when deployed on Vercel).
 * These are approximate and should not be treated as precise geolocation.
 */
export interface GeoLocation {
  country: string | null;
  region: string | null;
  city: string | null;
}

/** Vercel percent-encodes these values ("Milton%20Keynes"); store them readable. */
function decode(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getGeoFromHeaders(request: Request): GeoLocation {
  return {
    country: request.headers.get("x-vercel-ip-country") ?? null,
    region: decode(request.headers.get("x-vercel-ip-country-region")),
    city: decode(request.headers.get("x-vercel-ip-city")),
  };
}
