"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/errors";

export default function CancelRequestButton({
  requestId,
}: {
  requestId: Id<"borrowRequests">;
}) {
  const cancelRequest = useMutation(api.borrowRequests.cancelBorrowRequest);
  const [confirming, setConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setError(null);
    setIsCancelling(true);

    try {
      await cancelRequest({ requestId });
      setConfirming(false);
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    } finally {
      setIsCancelling(false);
    }
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
            setError(null);
          }}
          className="text-sm font-medium text-red-700 transition hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
        >
          Cancel request
        </button>
        {error ? (
          <p className="text-xs text-red-700 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Cancel this request?
        </span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isCancelling}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Keep request
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isCancelling}
          className="rounded-full bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500 dark:text-red-950 dark:hover:bg-red-400"
        >
          {isCancelling ? "Cancelling…" : "Confirm cancel"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
