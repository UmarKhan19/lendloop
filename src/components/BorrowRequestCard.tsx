import Link from "next/link";
import type { ReactNode } from "react";
import RequestStatusBadge from "@/components/RequestStatusBadge";
import {
  formatBorrowDate,
  formatBorrowTimestamp,
  type BorrowRequestDetails,
} from "@/lib/borrow";

export default function BorrowRequestCard({
  request,
  showBorrower = false,
  actions,
}: {
  request: BorrowRequestDetails;
  showBorrower?: boolean;
  actions?: ReactNode;
}) {
  const timestamps = [
    { label: "Decided", value: request.decidedAt },
    { label: "Cancelled", value: request.cancelledAt },
    { label: "Returned", value: request.returnedAt },
  ].filter(
    (entry): entry is { label: string; value: number } =>
      entry.value !== undefined,
  );

  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              <Link
                href={`/requests/${request._id}`}
                className="transition hover:text-emerald-700 dark:hover:text-emerald-400"
              >
                {request.tool?.name ?? "Tool unavailable"}
              </Link>
            </h2>
            {request.tool?.isArchived ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Archived
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {request.tool?.category ?? "Listing details unavailable"}
          </p>
          {showBorrower ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Borrowed by{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {request.borrower?.displayName ?? "Unknown member"}
              </span>
            </p>
          ) : null}
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <dl className="mt-5 grid gap-4 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Dates
          </dt>
          <dd className="mt-1 text-zinc-800 dark:text-zinc-200">
            {formatBorrowDate(request.startDate)} –{" "}
            {formatBorrowDate(request.endDate)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Requested
          </dt>
          <dd className="mt-1 text-zinc-800 dark:text-zinc-200">
            {formatBorrowTimestamp(request.requestedAt)}
          </dd>
        </div>
        {timestamps.map((entry) => (
          <div key={entry.label}>
            <dt className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              {entry.label}
            </dt>
            <dd className="mt-1 text-zinc-800 dark:text-zinc-200">
              {formatBorrowTimestamp(entry.value)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <Link
          href={`/requests/${request._id}`}
          className="text-sm font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          View request →
        </Link>
        {actions}
      </div>
    </article>
  );
}
