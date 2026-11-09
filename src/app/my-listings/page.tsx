"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import DeleteToolButton from "@/components/DeleteToolButton";
import { EmptyPanel, LoadingGrid } from "@/components/PageStates";
import RequireAuth from "@/components/RequireAuth";
import ToolCard from "@/components/ToolCard";

const PAGE_SIZE = 20;

export default function MyListingsPage() {
  return (
    <RequireAuth
      title="Sign in to manage your listings"
      description="Your listings page shows the tools you have shared, with options to edit or archive them."
    >
      <MyListings />
    </RequireAuth>
  );
}

function MyListings() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.tools.listMyTools,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const activeCount = useQuery(api.tools.countMyActiveTools, {});

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Your shelf
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
              My listings
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Edit the details of your active listings or archive a tool you no
              longer want to share. Archived listings are kept out of public
              browsing.
            </p>
          </div>
          <Link
            href="/tools/new"
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
          >
            Add a tool
          </Link>
        </div>

        <div className="mt-8">
          {status === "LoadingFirstPage" ? (
            <LoadingGrid />
          ) : results.length === 0 ? (
            <EmptyPanel
              title="You haven't listed any tools yet"
              description="Share something from your shed or toolbox and it will appear here. You can edit or archive it at any time."
              action={
                <Link
                  href="/tools/new"
                  className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  List your first tool
                </Link>
              }
            />
          ) : (
            <>
              {activeCount === undefined ? null : (
                <p className="mb-4 text-sm text-zinc-500">
                  {activeCount} active{" "}
                  {activeCount === 1 ? "listing" : "listings"}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((tool) => (
                  <ToolCard
                    key={tool._id}
                    tool={tool}
                    actions={
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/tools/${tool._id}`}
                          className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
                        >
                          View
                        </Link>
                        <Link
                          href={`/tools/${tool._id}/edit`}
                          className="text-sm font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                        >
                          Edit
                        </Link>
                        <DeleteToolButton
                          toolId={tool._id}
                          toolName={tool.name}
                        />
                      </div>
                    }
                  />
                ))}
              </div>

              <div className="mt-8 flex justify-center">
                {status === "CanLoadMore" || status === "LoadingMore" ? (
                  <button
                    type="button"
                    onClick={() => loadMore(PAGE_SIZE)}
                    disabled={status === "LoadingMore"}
                    className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {status === "LoadingMore" ? "Loading…" : "Load more"}
                  </button>
                ) : (
                  <p className="text-sm text-zinc-500">
                    You&apos;ve reached the end of your listings.
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
