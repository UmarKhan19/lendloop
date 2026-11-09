"use client";

import { useSyncExternalStore } from "react";
import {
  createUtcDateWatcher,
  utcDateFor,
} from "@/lib/utcDate";

let snapshot: string | null = null;
let watcher: ReturnType<typeof createUtcDateWatcher> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!watcher) {
    snapshot = utcDateFor();
    watcher = createUtcDateWatcher({
      onChange: (date) => {
        snapshot = date;
        notifyListeners();
      },
    });
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      watcher?.stop();
      watcher = null;
      snapshot = null;
    }
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return null;
}

// Returns null during SSR and the first client render, then the current UTC
// calendar date. The external store keeps hydration safe while the watcher
// handles midnight, tab visibility, and window focus.
export default function useUtcDate(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
