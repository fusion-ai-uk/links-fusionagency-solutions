/**
 * Detect likely bots, scanners and mail-proxy fetchers from User-Agent strings.
 * We record the verdict but never block — the pixel and redirect always work.
 *
 * Each pattern carries a reason so the dashboard can say *why* a row was
 * flagged, rather than just "bot".
 */
export interface BotVerdict {
  isBot: boolean;
  /** Short machine-readable reason, e.g. "google-image-proxy". Null when not a bot. */
  reason: string | null;
}

const PATTERNS: { reason: string; pattern: RegExp }[] = [
  // Mail-client image proxies. These fetch the open pixel on the recipient's
  // behalf, often from another country, whether or not the mail was read.
  { reason: "google-image-proxy", pattern: /GoogleImageProxy/i },
  { reason: "yahoo-mail-proxy", pattern: /YahooMailProxy/i },

  // Link previewers and security scanners that identify themselves.
  { reason: "skype-teams-preview", pattern: /SkypeUriPreview/i },
  { reason: "barracuda-scanner", pattern: /Barracuda/i },
  { reason: "slack-link-expander", pattern: /Slackbot-LinkExpanding/i },

  // Generic crawler / bot signatures.
  { reason: "generic-bot", pattern: /bot\b/i },
  { reason: "crawler", pattern: /crawler|spider|slurp|scrapy/i },
  { reason: "http-library", pattern: /curl\/|wget\/|python-requests|go-http-client|java\/|libwww|httpclient/i },
  { reason: "headless-browser", pattern: /headless|phantomjs|selenium|puppeteer|playwright/i },
  { reason: "search-engine", pattern: /googlebot|bingbot|yandex|baiduspider|applebot|petalbot|bytespider/i },
  { reason: "social-preview", pattern: /facebookexternalhit|linkedinbot|twitterbot/i },
  { reason: "seo-tool", pattern: /semrush|ahrefs|mj12bot|dotbot/i },
  { reason: "ai-crawler", pattern: /gptbot|claudebot|anthropic|openai/i },
  { reason: "security-scanner", pattern: /security|scanner|nmap|masscan|zgrab|nessus|nikto|sqlmap|dirbuster|gobuster|ffuf|burp|qualys|shodan|censys/i },
];

export function detectBot(userAgent: string | null | undefined): BotVerdict {
  if (!userAgent) return { isBot: false, reason: null };
  for (const { reason, pattern } of PATTERNS) {
    if (pattern.test(userAgent)) return { isBot: true, reason };
  }
  return { isBot: false, reason: null };
}

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  return detectBot(userAgent).isBot;
}

/** Human-readable explanation for a bot reason, for tooltips and tables. */
export const BOT_REASON_LABELS: Record<string, string> = {
  "google-image-proxy": "Gmail image proxy — Google fetched the pixel on the recipient's behalf",
  "yahoo-mail-proxy": "Yahoo Mail image proxy",
  "skype-teams-preview": "Skype / Teams link preview",
  "barracuda-scanner": "Barracuda email security scanner",
  "slack-link-expander": "Slack link preview",
  "generic-bot": "User agent declares itself a bot",
  crawler: "Web crawler",
  "http-library": "Programmatic HTTP client (curl, python, Java, Go…)",
  "headless-browser": "Headless / automated browser",
  "search-engine": "Search engine crawler",
  "social-preview": "Social network link preview",
  "seo-tool": "SEO crawler",
  "ai-crawler": "AI crawler",
  "security-scanner": "Security scanning tool",
};
