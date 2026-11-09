"use client";

import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import BorrowRequestCard from "@/components/BorrowRequestCard";
import BorrowStatusFilter from "@/components/BorrowStatusFilter";
import CancelRequestButton from "@/components/CancelRequestButton";
import { EmptyPanel, LoadingPanel } from "@/components/PageStates";
import RequireAuth from "@/components/RequireAuth";
import {
  BORROW_STATUS_LABELS,
  getBorrowerActions,
  type BorrowStatus,
} from "@/lib/borrow";

const PAGE_SIZE = 20;

export default function MyRequestsPage() {
  return (
    <RequireAuth
      title="Sign in to track your requests"
      description="Your borrowing requests and their approval status are only visible to you, the tool owner, and admins."
    >
      <MyRequests />
    </RequireAuth>
  );
}

function MyRequests() {
  const [status, setStatus] = useState<BorrowStatus | "">("");
  const { results, status: queryStatus, loadMore } = usePaginatedQuery(
    api.borrowRequests.listOutgoingRequests,
    status === "" ? {} : { status },
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Borrowing
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
              My requests
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Track the tools you have asked to borrow. Pending requests can be
              cancelled until the owner makes a decision.
            </p>
          </div>
          <Link
            href="/tools"
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
          >
            Browse tools
          </Link>
        </div>

        <div className="mt-8">
          <BorrowStatusFilter value={status} onChange={setStatus} />
        </div>

        <div className="mt-6">
          {queryStatus === "LoadingFirstPage" ? (
            <LoadingPanel label="Loading your requests…" />
          ) : results.length === 0 ? (
            status ? (
              <EmptyPanel
                title={`No ${BORROW_STATUS_LABELS[status].toLowerCase()} requests`}
                description="There are no outgoing requests with this status. Try another filter or browse the catalogue."
                action={
                  <button
                    type="button"
                    onClick={() => setStatus("")}
                    className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    Show all statuses
                  </button>
                }
              />
            ) : (
              <EmptyPanel
                title="You haven't requested a tool yet"
                description="Browse the community catalogue and send a borrowing request for a date range that works for you."
                action={
                  <Link
                    href="/tools"
                    className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    Browse tools
                  </Link>
                }
              />
            )
          ) : (
            <>
              <div className="space-y-4">
                {results.map((request) => (
                  <BorrowRequestCard
                    key={request._id}
                    request={request}
                    actions={
                      getBorrowerActions(request.status).canCancel ? (
                        <CancelRequestButton requestId={request._id} />
                      ) : null
                    }
                  />
                ))}
              </div>

              <div className="mt-8 flex justify-center">
                {queryStatus === "CanLoadMore" ||
                queryStatus === "LoadingMore" ? (
                  <button
                    type="button"
                    onClick={() => loadMore(PAGE_SIZE)}
                    disabled={queryStatus === "LoadingMore"}
                    className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {queryStatus === "LoadingMore" ? "Loading…" : "Load more"}
                  </button>
                ) : (
                  <p className="text-sm text-zinc-500">
                    You&apos;ve reached the end of your requests.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
