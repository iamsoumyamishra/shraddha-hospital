/**
 * Reporting dates.
 *
 * Staff pick local calendar dates in the hospital's timezone. The database holds
 * UTC, so a selected range is converted to a half-open UTC interval
 * `[startLocal, dayAfterEndLocal)`. This keeps a submission at 23:59 local on the
 * last day inside the range and one at 00:00 the next day outside it, with no
 * off-by-one and no drift across a daylight-saving boundary.
 */

export const HOSPITAL_TIMEZONE = process.env.HOSPITAL_TIMEZONE ?? "Asia/Kolkata";

/** Offset in milliseconds for `date` in `timeZone`, e.g. +5:30 for IST. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/** Midnight local time on `yyyy-mm-dd` in `timeZone`, as a UTC instant. */
export function localDateStartToUtc(date: string, timeZone = HOSPITAL_TIMEZONE): Date {
  const { year, month, day } = splitDate(date);
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offset = zoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

/** Half-open UTC interval covering the inclusive local range. */
export function localDateRangeToUtcInterval(
  fromDate: string,
  toDate: string,
  timeZone = HOSPITAL_TIMEZONE,
): { from: Date; to: Date } {
  return {
    from: localDateStartToUtc(fromDate, timeZone),
    to: localDateStartToUtc(addDays(toDate, 1), timeZone),
  };
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = splitDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function splitDate(date: string): { year: number; month: number; day: number } {
  const parts = date.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return { year, month, day };
}

export function todayInTimeZone(timeZone = HOSPITAL_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/** Default window shown on the dashboard: the last 90 local days. */
export function defaultPeriod(
  timeZone = HOSPITAL_TIMEZONE,
): { from: string; to: string } {
  const today = todayInTimeZone(timeZone);
  return { from: addDays(today, -89), to: today };
}