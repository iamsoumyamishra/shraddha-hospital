import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  defaultPeriod,
  localDateRangeToUtcInterval,
  localDateStartToUtc,
  todayInTimeZone,
} from "@/modules/analytics/date-range";

/**
 * The dashboard filters on local calendar dates but stores UTC. These tests pin
 * the conversion, because an off-by-one here silently drops submissions from the
 * first or last day of every reporting period.
 */
describe("localDateStartToUtc", () => {
  it("maps IST midnight to the previous UTC day", () => {
    // Asia/Kolkata is UTC+05:30 with no daylight saving.
    const result = localDateStartToUtc("2026-03-01", "Asia/Kolkata");
    expect(result.toISOString()).toBe("2026-02-28T18:30:00.000Z");
  });

  it("maps a mid-year date correctly", () => {
    expect(localDateStartToUtc("2026-07-15", "Asia/Kolkata").toISOString()).toBe(
      "2026-07-14T18:30:00.000Z",
    );
  });

  it("is exactly a whole number of hours across a year", () => {
    // No DST in India, so every day of the year is the same offset. This is the
    // assumption that lets the simple offset calculation hold.
    const offsets = new Set<string>();
    for (let day = 1; day <= 365; day += 1) {
      const date = `2026-${String(Math.ceil(day / 31)).padStart(2, "0")}-${String(
        ((day - 1) % 31) + 1,
      ).padStart(2, "0")}`;
      offsets.add(localDateStartToUtc(date, "Asia/Kolkata").toISOString().slice(11, 16));
    }
    expect([...offsets]).toEqual(["18:30"]);
  });
});

describe("localDateRangeToUtcInterval", () => {
  it("produces a half-open interval covering the inclusive local range", () => {
    const { from, to } = localDateRangeToUtcInterval("2026-07-01", "2026-07-31", "Asia/Kolkata");

    // First moment included.
    expect(from.toISOString()).toBe("2026-06-30T18:30:00.000Z");
    // One day past local 31 July midnight: the last instant of 31 July is inside.
    expect(to.toISOString()).toBe("2026-07-31T18:30:00.000Z");
  });

  it("includes the last instant of the final day and excludes the next midnight", () => {
    const { from, to } = localDateRangeToUtcInterval("2026-07-01", "2026-07-01", "Asia/Kolkata");

    // 23:59:59 IST on 1 July. Must be counted.
    const lastSecondOfDay = new Date("2026-07-01T18:29:59.000Z");
    // 00:00:00 IST on 2 July. This is the exclusive upper bound.
    const firstSecondOfNextDay = new Date("2026-07-01T18:30:00.000Z");
    // 23:59:59 IST on 30 June, the day before the range starts.
    const lastSecondBefore = new Date("2026-06-30T18:29:59.000Z");

    expect(lastSecondOfDay.getTime()).toBeGreaterThanOrEqual(from.getTime());
    expect(lastSecondOfDay.getTime()).toBeLessThan(to.getTime());
    expect(firstSecondOfNextDay.getTime()).toBe(to.getTime());
    expect(lastSecondBefore.getTime()).toBeLessThan(from.getTime());
  });

  it("treats a single-day range as one full local day", () => {
    const { from, to } = localDateRangeToUtcInterval("2026-10-04", "2026-10-04", "Asia/Kolkata");
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("handles a range that crosses a month boundary", () => {
    const { from, to } = localDateRangeToUtcInterval("2026-01-30", "2026-02-02", "Asia/Kolkata");
    expect(from.toISOString()).toBe("2026-01-29T18:30:00.000Z");
    expect(to.toISOString()).toBe("2026-02-02T18:30:00.000Z");
  });
});

describe("addDays", () => {
  it("rolls over a month boundary", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("rolls back across a month boundary", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("handles a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("defaultPeriod", () => {
  it("spans 90 inclusive days ending today", () => {
    const today = todayInTimeZone("Asia/Kolkata");
    const period = defaultPeriod("Asia/Kolkata");

    expect(period.to).toBe(today);
    expect(period.from).toBe(addDays(today, -89));
    expect(localDateRangeToUtcInterval(period.from, period.to, "Asia/Kolkata")).toBeTruthy();
  });
});

describe("todayInTimeZone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports the local calendar date, not the UTC one", () => {
    // 2026-07-01T20:00:00Z is already 2 July in Kolkata but still 1 July in UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T20:00:00.000Z"));

    expect(todayInTimeZone("Asia/Kolkata")).toBe("2026-07-02");
    expect(todayInTimeZone("UTC")).toBe("2026-07-01");
  });

  it("uses the en-CA format so the string is yyyy-mm-dd, not mm/dd/yyyy", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-09T18:45:00.000Z"));

    // A locale that sorts differently would silently break lexicographic
    // comparison and the date inputs.
    expect(todayInTimeZone("Asia/Kolkata")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});