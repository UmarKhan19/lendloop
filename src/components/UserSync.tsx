"use client";

import { SignOutButton, useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { api } from "../../convex/_generated/api";
import {
  initialSyncState,
  isWaitingForSync,
  statusForUser,
  syncReducer,
  type SyncStatus,
} from "./userSyncState";

export default function UserSync({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);
  const [state, dispatch] = useReducer(syncReducer, initialSyncState);
  const attemptedUserId = useRef<string | null>(null);

  const sync = useCallback(
    (targetUserId: string) => {
      attemptedUserId.current = targetUserId;
      dispatch({ type: "start", userId: targetUserId });

      syncCurrentUser()
        .then((result) =>
          dispatch({
            type: "succeeded",
            userId: targetUserId,
            syncedClerkId: result.clerkId,
          }),
        )
        .catch((error: unknown) => {
          console.error("Failed to sync user with Convex:", error);
          dispatch({ type: "failed", userId: targetUserId });
        });
    },
    [syncCurrentUser],
  );

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !userId) {
      attemptedUserId.current = null;
      dispatch({ type: "reset" });
      return;
    }

    if (attemptedUserId.current === userId) return;
    sync(userId);
  }, [isLoading, isAuthenticated, userId, sync]);

  const status = statusForUser(state, userId);

  if (isWaitingForSync(state, userId, isLoaded, isAuthenticated)) {
    return (
      <SyncScreen
        status={isLoaded && isAuthenticated ? status : "idle"}
        onRetry={() => {
          if (userId) sync(userId);
        }}
      />
    );
  }

  return children;
}

function SyncScreen({
  status,
  onRetry,
}: {
  status: SyncStatus;
  onRetry: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {status === "error" ? (
          <>
            <h1 className="text-lg font-semibold tracking-tight">
              Couldn&apos;t sync your account
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              We couldn&apos;t create your LendLoop profile. Check your
              connection and try again.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Retry
              </button>
              <SignOutButton>
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Sign out
                </button>
              </SignOutButton>
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500">Preparing your account…</p>
        )}
      </section>
    </main>
  );
}
