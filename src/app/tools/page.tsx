"use client";

import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { EmptyPanel, LoadingGrid } from "@/components/PageStates";
import RequireAuth from "@/components/RequireAuth";
import ToolCard from "@/components/ToolCard";
import {
  isToolCategory,
  TOOL_CATEGORIES,
  type ToolCategory,
} from "@/lib/toolOptions";

const PAGE_SIZE = 20;

export default function BrowseToolsPage() {
  return (
    <RequireAuth
      title="Sign in to browse tools"
      description="Full listing details are available to signed-in members. Sign in or create an account to see what the community is sharing."
    >
      <BrowseTools />
    </RequireAuth>
  );
}

function BrowseTools() {
  const [category, setCategory] = useState<ToolCategory | "">("");
  const { results, status, loadMore } = usePaginatedQuery(
    api.tools.listTools,
    category === "" ? {} : { category },
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Browse
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
              Browse shared tools
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Every active listing from the LendLoop community. Open a listing
              to see the full description, category, and condition.
            </p>
          </div>
          <Link
            href="/tools/new"
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
          >
            List a tool
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <label
            htmlFor="category-filter"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Filter by category
          </label>
          <select
            id="category-filter"
            value={category}
            onChange={(event) => {
              const value = event.target.value;
              setCategory(isToolCategory(value) ? value : "");
            }}
            className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20"
          >
            <option value="">All categories</option>
            {TOOL_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {category ? (
            <button
              type="button"
              onClick={() => setCategory("")}
              className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              Clear filter
            </button>
          ) : null}
        </div>

        <div className="mt-8">
          {status === "LoadingFirstPage" ? (
            <LoadingGrid />
          ) : results.length === 0 ? (
            category ? (
              <EmptyPanel
                title="No tools in this category"
                description="There are no active listings in this category yet. Try another category or clear the filter."
                action={
                  <button
                    type="button"
                    onClick={() => setCategory("")}
                    className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    Show all categories
                  </button>
                }
              />
            ) : (
              <EmptyPanel
                title="No tools listed yet"
                description="The catalogue is empty right now. Add the first tool and get the lending started."
                action={
                  <Link
                    href="/tools/new"
                    className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    List a tool
                  </Link>
                }
              />
            )
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((tool) => (
                  <ToolCard key={tool._id} tool={tool} />
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
                    You&apos;ve reached the end of the listings.
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
