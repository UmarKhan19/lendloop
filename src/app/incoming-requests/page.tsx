"use client";

import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import BorrowRequestCard from "@/components/BorrowRequestCard";
import BorrowStatusFilter from "@/components/BorrowStatusFilter";
import IncomingRequestActions from "@/components/IncomingRequestActions";
import { EmptyPanel, LoadingPanel } from "@/components/PageStates";
import RequireAuth from "@/components/RequireAuth";
import {
  BORROW_STATUS_LABELS,
  type BorrowStatus,
} from "@/lib/borrow";

const PAGE_SIZE = 20;

export default function IncomingRequestsPage() {
  return (
    <RequireAuth
      title="Sign in to manage incoming requests"
      description="Approve, decline, and track borrowing requests for the tools you have listed."
    >
      <IncomingRequests />
    </RequireAuth>
  );
}

function IncomingRequests() {
  const [status, setStatus] = useState<BorrowStatus | "">("");
  const { results, status: queryStatus, loadMore } = usePaginatedQuery(
    api.borrowRequests.listIncomingRequests,
    status === "" ? {} : { status },
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Lending
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
              Incoming requests
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Manage requests for tools you have listed. Approving a request
              reserves its dates until you mark the loan returned.
            </p>
          </div>
          <Link
            href="/my-listings"
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            My listings
          </Link>
        </div>

        <div className="mt-8">
          <BorrowStatusFilter value={status} onChange={setStatus} />
        </div>

        <div className="mt-6">
          {queryStatus === "LoadingFirstPage" ? (
            <LoadingPanel label="Loading incoming requests…" />
          ) : results.length === 0 ? (
            status ? (
              <EmptyPanel
                title={`No ${BORROW_STATUS_LABELS[status].toLowerCase()} requests`}
                description="There are no incoming requests with this status. Try another filter."
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
                title="No incoming requests yet"
                description="When another member asks to borrow one of your tools, their request will appear here for you to review."
                action={
                  <Link
                    href="/my-listings"
                    className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    View my listings
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
                    showBorrower
                    actions={<IncomingRequestActions request={request} />}
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
                    You&apos;ve reached the end of your incoming requests.
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
