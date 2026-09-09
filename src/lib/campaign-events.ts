/** A short, readable form of a user agent for tables. */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "—";
  const ua = userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Macintosh|Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : null;
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) && /Version\//.test(ua) ? "Safari"
    : /Outlook/i.test(ua) ? "Outlook"
    : null;
  const parts = [browser, os].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return ua.length > 44 ? `${ua.slice(0, 41)}…` : ua;
}
