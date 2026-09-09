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

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export interface UkParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** The UK calendar date and clock time of an instant. */
export function ukParts(date: Date): UkParts {
  const parts: Record<string, number> = {};
  for (const p of partsFormat.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  // en-GB reports midnight as 24 in some engines; normalise.
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
  };
}

const pad = (v: number) => String(v).padStart(2, "0");

/** "2026-09-10" — the UK calendar day an instant falls on. */
export function ukDayKey(date: Date): string {
  const p = ukParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "2026-09-10T11" — the UK clock hour an instant falls in. */
export function ukHourKey(date: Date): string {
  const p = ukParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}`;
}

/**
 * An instant safely inside a UK day key: noon UTC is 12:00 or 13:00 UK time
 * on that same date whatever the season, so stepping it by 24 hours walks
 * calendar days without DST surprises.
 */
export function ukDayAnchor(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** The next UK day key after this one. */
export function nextUkDay(dayKey: string): string {
  return ukDayKey(new Date(ukDayAnchor(dayKey).getTime() + 86_400_000));
}

const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: UK_TIME_ZONE, day: "numeric", month: "short" });
const shortHour = new Intl.DateTimeFormat("en-GB", { timeZone: UK_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: UK_TIME_ZONE, weekday: "short" });

/** "10 Sep" for a day key. */
export function formatUkDayShort(dayKey: string): string {
  return shortDay.format(ukDayAnchor(dayKey)).replace(/\bSept\b/, "Sep");
}

/** "Thu 10 Sep" for a day key. */
export function formatUkDayWithWeekday(dayKey: string): string {
  const anchor = ukDayAnchor(dayKey);
  return `${weekday.format(anchor)} ${shortDay.format(anchor).replace(/\bSept\b/, "Sep")}`;
}

/** "11:00" in UK time. */
export function formatUkClock(date: Date): string {
  return shortHour.format(date).replace(/^24/, "00");
}
