import { ConvexError } from "convex/values";

// All borrowing dates are calendar dates in UTC, represented as YYYY-MM-DD.
// Both ends are inclusive, so 2026-01-01 to 2026-01-01 is a one-day loan.
export const MAX_BORROW_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DayRange = {
  startDay: number;
  endDay: number;
};

// Returns a UTC day number, or null when the value is not a real calendar
// date. This rejects things like 2026-02-30, 2025-02-29, and 2026-2-01.
export function parseDateOnly(value: string): number | null {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return null;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  // Start from an arbitrary date and set the full year explicitly so years
  // 0000-0099 are not interpreted as 1900-1999 by Date.UTC.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(date.getTime() / DAY_MS);
}

export function formatDateOnly(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function todayUtcDay(now = Date.now()): number {
  return Math.floor(now / DAY_MS);
}

export function validateBorrowDates(
  startDate: string,
  endDate: string,
  now = Date.now(),
): DayRange {
  const startDay = parseDateOnly(startDate);
  if (startDay === null) {
    throw new ConvexError(
      "Start date must be a valid date in YYYY-MM-DD format",
    );
  }

  const endDay = parseDateOnly(endDate);
  if (endDay === null) {
    throw new ConvexError("End date must be a valid date in YYYY-MM-DD format");
  }

  if (startDay < todayUtcDay(now)) {
    throw new ConvexError("Start date cannot be in the past");
  }
  if (endDay < startDay) {
    throw new ConvexError("End date must be on or after the start date");
  }
  if (endDay - startDay + 1 > MAX_BORROW_DAYS) {
    throw new ConvexError(
      `Borrowing period cannot exceed ${MAX_BORROW_DAYS} days`,
    );
  }

  return { startDay, endDay };
}

// Inclusive overlap for canonical YYYY-MM-DD strings:
// startA <= endB && endA >= startB.
export function dateRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && endA >= startB;
}
