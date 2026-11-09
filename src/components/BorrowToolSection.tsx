"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  formatBorrowDate,
  todayDateOnly,
  validateBorrowDateRange,
} from "@/lib/borrow";
import { getErrorMessage } from "@/lib/errors";

const labelClass =
  "block text-sm font-medium text-zinc-800 dark:text-zinc-200";
const fieldClass =
  "mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20";

export default function BorrowToolSection({
  toolId,
}: {
  toolId: Id<"tools">;
}) {
  const isOwner = useQuery(api.tools.isToolOwner, { toolId });
  const createBorrowRequest = useMutation(
    api.borrowRequests.createBorrowRequest,
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRequestId, setCreatedRequestId] =
    useState<Id<"borrowRequests"> | null>(null);

  const today = todayDateOnly();
  const hasDates = Boolean(startDate || endDate);
  const validationError = validateBorrowDateRange(startDate, endDate);
  const canCheck =
    Boolean(startDate && endDate) &&
    validationError === null &&
    isOwner === false;

  const availability = useQuery(
    api.borrowRequests.checkToolAvailability,
    canCheck ? { toolId, startDate, endDate } : "skip",
  );

  function updateStartDate(value: string) {
    setStartDate(value);
    setError(null);
    setCreatedRequestId(null);
  }

  function updateEndDate(value: string) {
    setEndDate(value);
    setError(null);
    setCreatedRequestId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatedRequestId(null);

    const dateError = validateBorrowDateRange(startDate, endDate);
    if (dateError) {
      setError(dateError);
      return;
    }
    if (availability !== true) {
      setError("Check availability for these dates before sending a request.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const requestId = await createBorrowRequest({
        toolId,
        startDate,
        endDate,
      });
      setCreatedRequestId(requestId);
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isOwner === undefined) {
    return (
      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <p className="text-sm text-zinc-500" role="status">
          Checking borrowing options…
        </p>
      </section>
    );
  }

  if (isOwner) {
    return (
      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          Borrowing
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          This is your listing
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          You cannot request your own tool. Requests from other members appear
          on your incoming requests page.
        </p>
        <Link
          href="/incoming-requests"
          className="mt-4 inline-block text-sm font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          Go to incoming requests →
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
        Borrowing
      </p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Request this tool
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Choose an inclusive date range. Dates use UTC calendar days and a
        request can cover at most 90 days.
      </p>

      {createdRequestId ? (
        <div
          role="status"
          className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200"
        >
          <p className="font-medium">Request sent.</p>
          <p className="mt-1">
            The owner will review it. Pending requests do not reserve the dates.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Link
              href={`/requests/${createdRequestId}`}
              className="font-medium underline underline-offset-4"
            >
              View request
            </Link>
            <Link
              href="/my-requests"
              className="font-medium underline underline-offset-4"
            >
              My requests
            </Link>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="borrow-start-date" className={labelClass}>
              Start date
            </label>
            <input
              id="borrow-start-date"
              type="date"
              value={startDate}
              min={today}
              onChange={(event) => updateStartDate(event.target.value)}
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="borrow-end-date" className={labelClass}>
              End date
            </label>
            <input
              id="borrow-end-date"
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(event) => updateEndDate(event.target.value)}
              required
              className={fieldClass}
            />
          </div>
        </div>

        <div
          aria-live="polite"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            availability === true
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200"
              : availability === false
                ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200"
                : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400"
          }`}
        >
          {hasDates && validationError ? (
            validationError
          ) : !startDate || !endDate ? (
            "Choose both dates to check availability."
          ) : availability === undefined ? (
            <span role="status">Checking availability for these dates…</span>
          ) : availability ? (
            <>
              Available from {formatBorrowDate(startDate)} to{" "}
              {formatBorrowDate(endDate)}.
            </>
          ) : (
            <>
              Not available for these dates. Try a different range or check the
              tool again later.
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={
              isSubmitting || validationError !== null || availability !== true
            }
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
          >
            {isSubmitting ? "Sending request…" : "Send borrow request"}
          </button>
          <p className="text-xs text-zinc-500">
            Availability is rechecked again when the owner approves.
          </p>
        </div>
      </form>
    </section>
  );
}
