import { expect, test } from "bun:test";
import {
  dateRangesOverlap,
  formatDateOnly,
  MAX_BORROW_DAYS,
  parseDateOnly,
  todayUtcDay,
  validateBorrowDates,
} from "./borrowDates";

function dateFromToday(offset: number) {
  return formatDateOnly(todayUtcDay() + offset);
}

test("parseDateOnly accepts real dates including leap years", () => {
  expect(parseDateOnly("2024-02-29")).not.toBeNull();
  expect(parseDateOnly("2000-02-29")).not.toBeNull();
  expect(parseDateOnly("2026-11-09")).not.toBeNull();
  expect(parseDateOnly("2026-12-31")).not.toBeNull();
});

test("parseDateOnly rejects malformed and impossible calendar dates", () => {
  for (const value of [
    "2023-02-29",
    "1900-02-29",
    "2026-02-30",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "2026-1-01",
    "2026-01-01T00:00:00Z",
    "01-01-2026",
    "",
  ]) {
    expect(parseDateOnly(value)).toBeNull();
  }
});

test("validateBorrowDates accepts today and enforces the 90-day inclusive limit", () => {
  const today = dateFromToday(0);
  expect(validateBorrowDates(today, today)).toEqual({
    startDay: todayUtcDay(),
    endDay: todayUtcDay(),
  });

  const start = dateFromToday(1);
  const lastAllowedDay = dateFromToday(MAX_BORROW_DAYS);
  expect(() => validateBorrowDates(start, lastAllowedDay)).not.toThrow();
  expect(() =>
    validateBorrowDates(start, dateFromToday(MAX_BORROW_DAYS + 1)),
  ).toThrow(`Borrowing period cannot exceed ${MAX_BORROW_DAYS} days`);
});

test("validateBorrowDates rejects past, reversed, and invalid dates", () => {
  expect(() =>
    validateBorrowDates(dateFromToday(-1), dateFromToday(5)),
  ).toThrow("Start date cannot be in the past");

  expect(() =>
    validateBorrowDates(dateFromToday(5), dateFromToday(4)),
  ).toThrow("End date must be on or after the start date");

  expect(() =>
    validateBorrowDates("2026-02-30", dateFromToday(5)),
  ).toThrow("Start date must be a valid date in YYYY-MM-DD format");

  expect(() =>
    validateBorrowDates(dateFromToday(1), "2026-04-31"),
  ).toThrow("End date must be a valid date in YYYY-MM-DD format");
});

test("dateRangesOverlap treats both endpoints as inclusive", () => {
  expect(dateRangesOverlap("2026-01-10", "2026-01-20", "2026-01-20", "2026-01-25")).toBe(true);
  expect(dateRangesOverlap("2026-01-10", "2026-01-20", "2026-01-01", "2026-01-10")).toBe(true);
  expect(dateRangesOverlap("2026-01-10", "2026-01-20", "2026-01-15", "2026-01-16")).toBe(true);
  expect(dateRangesOverlap("2026-01-10", "2026-01-20", "2026-01-21", "2026-01-25")).toBe(false);
  expect(dateRangesOverlap("2026-01-10", "2026-01-20", "2026-01-01", "2026-01-09")).toBe(false);
});
