"use client";

import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { EmptyPanel, LoadingGrid } from "@/components/PageStates";
import useUtcDate from "@/hooks/useUtcDate";
import { TOOL_CATEGORIES } from "@/lib/toolOptions";

export default function Home() {
  const utcDate = useUtcDate();
  const publicTools = useQuery(
    api.tools.listPublicTools,
    utcDate === null ? "skip" : { refreshDate: utcDate },
  );
  const activeCount = useQuery(api.tools.getActiveToolCount);

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Community tool library
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-5xl">
              Borrow what you need. Lend what you don&apos;t.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              LendLoop helps neighbours share the tools they already own. Browse
              the catalogue, list your own equipment, and keep everything in one
              place.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Show when="signed-out">
                <SignInButton forceRedirectUrl="/tools">
                  <button
                    type="button"
                    className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
                  >
                    Sign in to browse
                  </button>
                </SignInButton>
                <SignUpButton forceRedirectUrl="/tools">
                  <button
                    type="button"
                    className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Create an account
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/tools"
                  className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
                >
                  Browse tools
                </Link>
                <Link
                  href="/tools/new"
                  className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  List a tool
                </Link>
              </Show>
            </div>

            <Show when="signed-out">
              <p className="mt-5 text-sm text-zinc-500">
                Signed-out visitors can see tool names and categories. Sign in
                for descriptions, condition, and full listing details.
              </p>
            </Show>
          </div>

          <aside className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-9">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
              Active listings
            </p>
            <p className="mt-4 text-5xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {activeCount === undefined ? "…" : activeCount}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              active tool listings shared by the community. A listing can still
              be reserved for a specific date.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {TOOL_CATEGORIES.slice(0, 6).map((category) => (
                <span
                  key={category}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {category}
                </span>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-16 sm:mt-20" aria-labelledby="catalogue-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="catalogue-heading"
                className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
              >
                Available today
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                A preview of tools with no approved loan covering today.
              </p>
            </div>
            <Show when="signed-in">
              <Link
                href="/tools"
                className="text-sm font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                Open full listings →
              </Link>
            </Show>
          </div>

          <div className="mt-6">
            {publicTools === undefined ? (
              <LoadingGrid count={6} />
            ) : publicTools.length === 0 ? (
              <EmptyPanel
                title="No tools available today"
                description="Every active listing is reserved for today, or the catalogue is empty. Check back later or sign in to share a tool."
                action={
                  <Show when="signed-out">
                    <SignUpButton forceRedirectUrl="/tools/new">
                      <button
                        type="button"
                        className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                      >
                        Create an account
                      </button>
                    </SignUpButton>
                  </Show>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {publicTools.map((tool, index) => (
                  <div
                    key={`${tool.name}-${tool.category}-${index}`}
                    className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <h3 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                      {tool.name}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {tool.category}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Show when="signed-out">
            <div className="mt-8 flex flex-wrap items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
              <p className="flex-1">
                Want to see the full listings and share your own tools?
              </p>
              <SignInButton forceRedirectUrl="/tools">
                <button
                  type="button"
                  className="rounded-full bg-emerald-800 px-4 py-2 font-medium text-white transition hover:bg-emerald-900 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300"
                >
                  Sign in
                </button>
              </SignInButton>
            </div>
          </Show>
        </section>
      </section>
    </main>
  );
}
