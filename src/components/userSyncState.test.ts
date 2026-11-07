import { expect, test } from "bun:test";
import {
  initialSyncState,
  isWaitingForSync,
  statusForUser,
  syncReducer,
} from "./userSyncState";

function syncedState(userId: string) {
  return syncReducer(
    syncReducer(initialSyncState, { type: "start", userId }),
    { type: "succeeded", userId, syncedClerkId: userId },
  );
}

test("switching users ignores the previous user's status and result", () => {
  let state = syncReducer(initialSyncState, {
    type: "start",
    userId: "user_a",
  });
  state = syncReducer(state, {
    type: "succeeded",
    userId: "user_a",
    syncedClerkId: "user_a",
  });
  expect(statusForUser(state, "user_a")).toBe("synced");

  // The new account must not inherit the previous account's synced status.
  expect(statusForUser(state, "user_b")).toBe("idle");

  state = syncReducer(state, { type: "start", userId: "user_b" });
  expect(statusForUser(state, "user_b")).toBe("syncing");

  // Late results for the old account must not affect the new one.
  state = syncReducer(state, {
    type: "succeeded",
    userId: "user_a",
    syncedClerkId: "user_a",
  });
  state = syncReducer(state, { type: "failed", userId: "user_a" });
  expect(statusForUser(state, "user_b")).toBe("syncing");

  state = syncReducer(state, {
    type: "succeeded",
    userId: "user_b",
    syncedClerkId: "user_b",
  });
  expect(statusForUser(state, "user_b")).toBe("synced");
});

test("does not mark the user synced when the backend clerkId differs", () => {
  let state = syncReducer(initialSyncState, {
    type: "start",
    userId: "user_a",
  });

  state = syncReducer(state, {
    type: "succeeded",
    userId: "user_a",
    syncedClerkId: "user_b",
  });

  expect(statusForUser(state, "user_a")).toBe("error");
  expect(statusForUser(state, "user_b")).toBe("idle");
});

test("does not treat a loading Clerk session as confirmed signed out", () => {
  // Clerk is still loading: block until it confirms the session state.
  expect(isWaitingForSync(initialSyncState, undefined, false, false)).toBe(
    true,
  );

  // Clerk confirms sign-out: public pages stay accessible.
  expect(isWaitingForSync(initialSyncState, null, true, false)).toBe(false);
});

test("gates signed-in users until Convex auth and sync both succeed", () => {
  const syncedA = syncedState("user_a");

  // Clerk has a user, but Convex authentication has not succeeded yet.
  expect(isWaitingForSync(syncedA, "user_a", true, false)).toBe(true);

  // Convex is authenticated, but the profile is not synced for this user.
  expect(isWaitingForSync(initialSyncState, "user_a", true, true)).toBe(true);
  expect(isWaitingForSync(syncedA, "user_b", true, true)).toBe(true);

  // Both conditions are met.
  expect(isWaitingForSync(syncedA, "user_a", true, true)).toBe(false);
});

test("retry moves a failed sync back through syncing to synced", () => {
  let state = syncReducer(initialSyncState, {
    type: "start",
    userId: "user_a",
  });
  state = syncReducer(state, { type: "failed", userId: "user_a" });
  expect(statusForUser(state, "user_a")).toBe("error");

  state = syncReducer(state, { type: "start", userId: "user_a" });
  expect(statusForUser(state, "user_a")).toBe("syncing");

  state = syncReducer(state, {
    type: "succeeded",
    userId: "user_a",
    syncedClerkId: "user_a",
  });
  expect(statusForUser(state, "user_a")).toBe("synced");
});

test("reset clears the status after sign out", () => {
  let state = syncReducer(initialSyncState, {
    type: "start",
    userId: "user_a",
  });
  state = syncReducer(state, {
    type: "succeeded",
    userId: "user_a",
    syncedClerkId: "user_a",
  });

  state = syncReducer(state, { type: "reset" });
  expect(statusForUser(state, null)).toBe("idle");
  expect(statusForUser(state, "user_a")).toBe("idle");
});
