"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { EmptyPanel, LoadingPanel } from "@/components/PageStates";
import RequestStatusBadge from "@/components/RequestStatusBadge";
import RequireAuth from "@/components/RequireAuth";
import TrustedLenderBadge from "@/components/TrustedLenderBadge";
import {
  borrowDayCount,
  formatBorrowDate,
  formatBorrowTimestamp,
} from "@/lib/borrow";

export default function RequestDetailPage() {
  return (
    <RequireAuth
      title="Sign in to view this request"
      description="Borrow request details are limited to the borrower, the tool owner, and admins."
    >
      <RequestDetail />
    </RequireAuth>
  );
}

function RequestDetail() {
  const params = useParams<{ id: string }>();
  const request = useQuery(api.borrowRequests.getBorrowRequest, {
    requestId: params.id,
  });

  if (request === undefined) {
    return <LoadingPanel label="Loading request…" />;
  }

  if (request === null) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-lg">
          <EmptyPanel
            title="Request not found"
            description="This borrow request may not exist, or the link may be incorrect."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/my-requests"
                  className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  My requests
                </Link>
                <Link
                  href="/incoming-requests"
                  className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Incoming requests
                </Link>
              </div>
            }
          />
        </div>
      </main>
    );
  }

  const dayCount = borrowDayCount(request.startDate, request.endDate);
  const timeline = [
    { label: "Requested", value: request.requestedAt },
    { label: "Decided", value: request.decidedAt },
    { label: "Cancelled", value: request.cancelledAt },
    { label: "Returned", value: request.returnedAt },
  ].filter(
    (entry): entry is { label: string; value: number } =>
      entry.value !== undefined,
  );

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
        <Link
          href="/my-requests"
          className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back to my requests
        </Link>

        <article className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                Borrow request
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
                {request.tool?.name ?? "Tool unavailable"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <span>
                  {request.tool?.category ?? "Listing details unavailable"}
                </span>
                {request.tool?.isArchived ? (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    Archived listing
                  </span>
                ) : null}
              </div>
            </div>
            <RequestStatusBadge status={request.status} />
          </div>

          {request.tool?.isArchived ? (
            <p className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
              This tool has been archived. The borrowing history remains visible,
              but the listing is no longer part of the public catalogue.
            </p>
          ) : request.tool ? (
            <Link
              href={`/tools/${request.tool._id}`}
              className="mt-5 inline-block text-sm font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              View tool listing →
            </Link>
          ) : null}

          <dl className="mt-8 grid gap-6 border-t border-zinc-100 pt-6 dark:border-zinc-800 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                Borrowed by
              </dt>
              <dd className="mt-2 text-base font-medium text-zinc-900 dark:text-zinc-100">
                {request.borrower?.displayName ?? "Unknown member"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                Tool owner
              </dt>
              <dd className="mt-2 flex flex-wrap items-center gap-2 text-base font-medium text-zinc-900 dark:text-zinc-100">
                <span>{request.owner?.displayName ?? "Unknown member"}</span>
                {request.owner?.isTrustedLender ? (
                  <TrustedLenderBadge />
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                Requested dates
              </dt>
              <dd className="mt-2 text-base text-zinc-900 dark:text-zinc-100">
                {formatBorrowDate(request.startDate)} –{" "}
                {formatBorrowDate(request.endDate)}
              </dd>
              <p className="mt-1 text-sm text-zinc-500">
                {dayCount === null
                  ? "Invalid date range"
                  : `${dayCount} ${dayCount === 1 ? "day" : "days"} inclusive`}
              </p>
            </div>
          </dl>

          <div className="mt-8 border-t border-zinc-100 pt-6 dark:border-zinc-800">
            <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">
              Timeline
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {timeline.map((entry) => (
                <div key={entry.label}>
                  <dt className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                    {entry.label}
                  </dt>
                  <dd className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
                    {formatBorrowTimestamp(entry.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </article>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <p>Only the borrower, owner, and admins can see this request.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/my-requests"
              className="font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              My requests
            </Link>
            <Link
              href="/incoming-requests"
              className="font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Incoming requests
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
