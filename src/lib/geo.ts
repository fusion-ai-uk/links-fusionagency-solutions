/**
 * Coarse geo location from Vercel edge headers (when deployed on Vercel).
 * These are approximate and should not be treated as precise geolocation.
 */
export interface GeoLocation {
  country: string | null;
  region: string | null;
  city: string | null;
}

export function getGeoFromHeaders(request: Request): GeoLocation {
  return {
    country: request.headers.get("x-vercel-ip-country") ?? null,
    region: request.headers.get("x-vercel-ip-country-region") ?? null,
    city: request.headers.get("x-vercel-ip-city") ?? null,
  };
}
