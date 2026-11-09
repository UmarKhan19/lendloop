"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import BorrowToolSection from "@/components/BorrowToolSection";
import { EmptyPanel, LoadingPanel } from "@/components/PageStates";
import RequireAuth from "@/components/RequireAuth";
import { toolConditionLabel } from "@/lib/toolOptions";

export default function ToolDetailPage() {
  return (
    <RequireAuth
      title="Sign in to view this listing"
      description="Sign in to see the full description and condition of this tool."
    >
      <ToolDetail />
    </RequireAuth>
  );
}

function ToolDetail() {
  const params = useParams<{ id: string }>();
  const tool = useQuery(api.tools.getTool, { toolId: params.id });

  if (tool === undefined) {
    return <LoadingPanel label="Loading listing…" />;
  }

  if (tool === null) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-lg">
          <EmptyPanel
            title="Listing not available"
            description="This tool may have been archived or removed, or the link may be incorrect."
            action={
              <Link
                href="/tools"
                className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Browse tools
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
        <Link
          href="/tools"
          className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back to browse
        </Link>

        <article className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                Tool listing
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
                {tool.name}
              </h1>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {tool.category}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {toolConditionLabel(tool.condition)}
            </span>
          </div>

          <div className="mt-8 border-t border-zinc-100 pt-6 dark:border-zinc-800">
            <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">
              Description
            </h2>
            <p className="mt-3 whitespace-pre-line text-base leading-7 text-zinc-700 dark:text-zinc-300">
              {tool.description}
            </p>
          </div>
        </article>

        <BorrowToolSection toolId={tool._id} />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <p>Manage your own listings from your listings page.</p>
          <Link
            href="/my-listings"
            className="font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Go to My listings →
          </Link>
        </div>
      </div>
    </main>
  );
}
