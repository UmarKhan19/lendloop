"use client";

import Link from "next/link";
import { EmptyPanel } from "@/components/PageStates";
import { getErrorMessage } from "@/lib/errors";

export default function RequestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-lg">
        <EmptyPanel
          title="Request unavailable"
          description={getErrorMessage(
            error,
            "This request could not be loaded. It may have been removed, or you may not have access to it.",
          )}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Try again
              </button>
              <Link
                href="/my-requests"
                className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
