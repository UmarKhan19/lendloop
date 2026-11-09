import { expect, test } from "bun:test";
import { formatDateOnly, todayUtcDay } from "../../convex/borrowDates";
import {
  BORROW_STATUS_LABELS,
  BORROW_STATUS_ORDER,
  borrowDayCount,
  borrowStatusLabel,
  formatBorrowDate,
  getBorrowerActions,
  getOwnerActions,
  todayDateOnly,
  validateBorrowDateRange,
} from "./borrow";

function dateFromToday(offset: number) {
  return formatDateOnly(todayUtcDay() + offset);
}

test("every borrow status has a label and is included in the filter order", () => {
  expect(BORROW_STATUS_ORDER).toEqual([
    "pending",
    "approved",
    "declined",
    "cancelled",
    "returned",
  ]);

  for (const status of BORROW_STATUS_ORDER) {
    expect(BORROW_STATUS_LABELS[status].length).toBeGreaterThan(0);
    expect(borrowStatusLabel(status)).toBe(BORROW_STATUS_LABELS[status]);
  }
  expect(borrowStatusLabel("unknown")).toBe("unknown");
});

test("borrow form date validation matches the UTC inclusive rules", () => {
  expect(validateBorrowDateRange("", "")).toBe(
    "Choose both a start date and an end date.",
  );
  expect(validateBorrowDateRange("2026-02-30", dateFromToday(5))).toBe(
    "Enter a valid start date in YYYY-MM-DD format.",
  );
  expect(validateBorrowDateRange(dateFromToday(1), "2026-04-31")).toBe(
    "Enter a valid end date in YYYY-MM-DD format.",
  );
  expect(
    validateBorrowDateRange(dateFromToday(-1), dateFromToday(2)),
  ).toBe("Start date cannot be in the past.");
  expect(validateBorrowDateRange(dateFromToday(5), dateFromToday(4))).toBe(
    "End date must be on or after the start date.",
  );

  expect(
    validateBorrowDateRange(dateFromToday(1), dateFromToday(90)),
  ).toBeNull();
  expect(
    validateBorrowDateRange(dateFromToday(1), dateFromToday(91)),
  ).toBe("Borrowing period cannot exceed 90 days.");
});

test("borrow date helpers use inclusive UTC calendar days", () => {
  expect(borrowDayCount("2026-01-01", "2026-01-01")).toBe(1);
  expect(borrowDayCount("2024-02-28", "2024-03-01")).toBe(3);
  expect(borrowDayCount("2026-01-05", "2026-01-04")).toBeNull();
  expect(borrowDayCount("not-a-date", "2026-01-04")).toBeNull();
  expect(formatBorrowDate("2026-01-01")).toBe("1 Jan 2026");
  expect(todayDateOnly(0)).toBe("1970-01-01");
});

test("borrower actions only allow cancelling pending requests", () => {
  expect(getBorrowerActions("pending").canCancel).toBe(true);
  for (const status of ["approved", "declined", "cancelled", "returned"] as const) {
    expect(getBorrowerActions(status).canCancel).toBe(false);
  }
});

test("owner actions respect status and expired pending requests", () => {
  const today = dateFromToday(0);

  expect(getOwnerActions("pending", dateFromToday(1), today)).toEqual({
    canApprove: true,
    canDecline: true,
    canMarkReturned: false,
    isExpired: false,
  });
  expect(getOwnerActions("pending", dateFromToday(-1), today)).toEqual({
    canApprove: false,
    canDecline: true,
    canMarkReturned: false,
    isExpired: true,
  });
  expect(getOwnerActions("approved", dateFromToday(-1), today)).toEqual({
    canApprove: false,
    canDecline: false,
    canMarkReturned: true,
    isExpired: false,
  });

  for (const status of ["declined", "cancelled", "returned"] as const) {
    expect(getOwnerActions(status, dateFromToday(1), today)).toEqual({
      canApprove: false,
      canDecline: false,
      canMarkReturned: false,
      isExpired: false,
    });
  }
});
