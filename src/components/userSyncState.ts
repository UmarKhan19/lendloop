export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export type SyncState = {
  userId: string | null;
  status: SyncStatus;
};

export type SyncAction =
  | { type: "start"; userId: string }
  | { type: "succeeded"; userId: string; syncedClerkId: string }
  | { type: "failed"; userId: string }
  | { type: "reset" };

export const initialSyncState: SyncState = { userId: null, status: "idle" };

export function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case "start":
      return { userId: action.userId, status: "syncing" };
    case "succeeded":
      if (state.userId !== action.userId || state.status !== "syncing") {
        return state;
      }
      return {
        userId: action.userId,
        status:
          action.syncedClerkId === action.userId ? "synced" : "error",
      };
    case "failed":
      return state.userId === action.userId && state.status === "syncing"
        ? { userId: action.userId, status: "error" }
        : state;
    case "reset":
      return initialSyncState;
  }
}

export function statusForUser(
  state: SyncState,
  userId: string | null | undefined,
): SyncStatus {
  return state.userId === userId ? state.status : "idle";
}

export function isWaitingForSync(
  state: SyncState,
  userId: string | null | undefined,
  isClerkLoaded: boolean,
  isAuthenticated: boolean,
): boolean {
  if (!isClerkLoaded) return true;
  return (
    Boolean(userId) &&
    (!isAuthenticated || statusForUser(state, userId) !== "synced")
  );
}
