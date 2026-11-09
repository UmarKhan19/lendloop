"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { getOwnerActions, type BorrowRequestDetails } from "@/lib/borrow";
import { getErrorMessage } from "@/lib/errors";

type RequestAction = "approve" | "decline" | "return";

export default function IncomingRequestActions({
  request,
}: {
  request: BorrowRequestDetails;
}) {
  const approveRequest = useMutation(api.borrowRequests.approveBorrowRequest);
  const declineRequest = useMutation(api.borrowRequests.declineBorrowRequest);
  const markReturned = useMutation(
    api.borrowRequests.markBorrowRequestReturned,
  );
  const [working, setWorking] = useState<RequestAction | null>(null);
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions = getOwnerActions(request.status, request.startDate);

  async function run(action: RequestAction, operation: () => Promise<unknown>) {
    setError(null);
    setWorking(action);

    try {
      await operation();
      setConfirmingReturn(false);
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    } finally {
      setWorking(null);
    }
  }

  if (!actions.canApprove && !actions.canDecline && !actions.canMarkReturned) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {actions.canDecline ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              run("approve", () => approveRequest({ requestId: request._id }))
            }
            disabled={!actions.canApprove || working !== null}
            className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
          >
            {working === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() =>
              run("decline", () => declineRequest({ requestId: request._id }))
            }
            disabled={working !== null}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {working === "decline" ? "Declining…" : "Decline"}
          </button>
        </div>
      ) : null}

      {actions.isExpired ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          This request has expired and can no longer be approved.
        </p>
      ) : null}

      {actions.canMarkReturned ? (
        confirmingReturn ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Mark this loan returned?
            </span>
            <button
              type="button"
              onClick={() => setConfirmingReturn(false)}
              disabled={working !== null}
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Not yet
            </button>
            <button
              type="button"
              onClick={() =>
                run("return", () =>
                  markReturned({ requestId: request._id }),
                )
              }
              disabled={working !== null}
              className="rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {working === "return" ? "Marking…" : "Confirm returned"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfirmingReturn(true);
            }}
            className="self-start rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Mark returned
          </button>
        )
      ) : null}

      {error ? (
        <p className="text-xs text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
