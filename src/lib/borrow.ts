import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import {
  formatDateOnly,
  MAX_BORROW_DAYS,
  parseDateOnly,
  todayUtcDay,
} from "../../convex/borrowDates";

export type BorrowStatus = Doc<"borrowRequests">["status"];

export type BorrowRequestDetails = NonNullable<
  FunctionReturnType<typeof api.borrowRequests.getBorrowRequest>
>;

export const BORROW_STATUS_ORDER: readonly BorrowStatus[] = [
  "pending",
  "approved",
  "declined",
  "cancelled",
  "returned",
];

export const BORROW_STATUS_LABELS: Record<BorrowStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const BORROW_STATUS_STYLES: Record<BorrowStatus, string> = {
  pending:
    "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  approved:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  declined: "bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  cancelled:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  returned: "bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
};

const DAY_MS = 24 * 60 * 60 * 1_000;

export function borrowStatusLabel(status: string): string {
  return BORROW_STATUS_LABELS[status as BorrowStatus] ?? status;
}

export function validateBorrowDateRange(
  startDate: string,
  endDate: string,
  now = Date.now(),
): string | null {
  if (!startDate || !endDate) {
    return "Choose both a start date and an end date.";
  }

  const startDay = parseDateOnly(startDate);
  if (startDay === null) {
    return "Enter a valid start date in YYYY-MM-DD format.";
  }

  const endDay = parseDateOnly(endDate);
  if (endDay === null) {
    return "Enter a valid end date in YYYY-MM-DD format.";
  }

  if (startDay < todayUtcDay(now)) {
    return "Start date cannot be in the past.";
  }
  if (endDay < startDay) {
    return "End date must be on or after the start date.";
  }
  if (endDay - startDay + 1 > MAX_BORROW_DAYS) {
    return `Borrowing period cannot exceed ${MAX_BORROW_DAYS} days.`;
  }

  return null;
}

export function todayDateOnly(now = Date.now()): string {
  return formatDateOnly(todayUtcDay(now));
}

export function borrowDayCount(startDate: string, endDate: string): number | null {
  const startDay = parseDateOnly(startDate);
  const endDay = parseDateOnly(endDate);
  if (startDay === null || endDay === null || endDay < startDay) {
    return null;
  }
  return endDay - startDay + 1;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const timestampFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatBorrowDate(value: string): string {
  const day = parseDateOnly(value);
  if (day === null) {
    return value;
  }
  return dateFormatter.format(new Date(day * DAY_MS));
}

export function formatBorrowTimestamp(value: number): string {
  return `${timestampFormatter.format(new Date(value))} UTC`;
}

export function getBorrowerActions(status: BorrowStatus) {
  return {
    canCancel: status === "pending",
  };
}

export function getOwnerActions(
  status: BorrowStatus,
  startDate: string,
  today = todayDateOnly(),
) {
  const isPending = status === "pending";
  return {
    canApprove: isPending && startDate >= today,
    canDecline: isPending,
    canMarkReturned: status === "approved",
    isExpired: isPending && startDate < today,
  };
}
