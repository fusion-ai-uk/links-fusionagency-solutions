/**
 * All times shown in the interface are UK time (Europe/London), which follows
 * GMT/BST automatically. Stored timestamps stay UTC in the database and in the
 * CSV export (ISO 8601 with a Z), because that is unambiguous for analysis.
 */
export const UK_TIME_ZONE = "Europe/London";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const dateOnly = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** e.g. "09 Sep 2026 14:32:07" in UK time. */
export function formatUkTime(date: Date): string {
  // en-GB gives "09 Sept 2026, 14:32:07"; normalise the month and drop the comma.
  return dateTime
    .format(date)
    .replace(",", "")
    .replace(/\bSept\b/, "Sep");
}

/** e.g. "9 September 2026". */
export function formatUkDate(date: Date): string {
  return dateOnly.format(date);
}

/** Short label for column headings and hints. */
export const UK_TIME_LABEL = "UK time";
