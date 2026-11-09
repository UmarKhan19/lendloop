import { expect, test } from "bun:test";
import {
  createUtcDateWatcher,
  msUntilNextUtcMidnight,
  utcDateFor,
} from "./utcDate";

const DAY_MS = 24 * 60 * 60 * 1_000;

test("utcDateFor uses inclusive UTC calendar days", () => {
  expect(utcDateFor(Date.parse("2026-11-09T00:00:00.000Z"))).toBe(
    "2026-11-09",
  );
  expect(utcDateFor(Date.parse("2026-11-09T23:59:59.999Z"))).toBe(
    "2026-11-09",
  );
  expect(utcDateFor(Date.parse("2026-11-10T00:00:00.000Z"))).toBe(
    "2026-11-10",
  );
});

test("msUntilNextUtcMidnight targets the next UTC midnight", () => {
  expect(msUntilNextUtcMidnight(Date.parse("2026-11-09T23:59:00.000Z"))).toBe(
    60_000,
  );
  expect(msUntilNextUtcMidnight(Date.parse("2026-11-10T00:00:00.000Z"))).toBe(
    DAY_MS,
  );
  expect(msUntilNextUtcMidnight(Date.parse("2026-11-09T12:00:00.000Z"))).toBe(
    12 * 60 * 60 * 1_000,
  );
});

type ScheduledTimer = {
  callback: () => void;
  delay: number;
};

function createHarness(initialNow: number, visible = true) {
  let clock = initialNow;
  let nextHandle = 1;
  let scheduled: ScheduledTimer | null = null;
  let cancelled = 0;
  let visibilityListener: (() => void) | null = null;
  let focusListener: (() => void) | null = null;
  let visibilityRemovals = 0;
  let focusRemovals = 0;
  let documentVisible = visible;
  const changes: string[] = [];

  const watcher = createUtcDateWatcher<number>({
    now: () => clock,
    schedule: (callback, delay) => {
      scheduled = { callback, delay };
      return nextHandle++;
    },
    cancel: () => {
      cancelled += 1;
    },
    addVisibilityListener: (listener) => {
      visibilityListener = listener;
    },
    removeVisibilityListener: () => {
      visibilityRemovals += 1;
    },
    addFocusListener: (listener) => {
      focusListener = listener;
    },
    removeFocusListener: () => {
      focusRemovals += 1;
    },
    isVisible: () => documentVisible,
    onChange: (date) => changes.push(date),
  });

  return {
    watcher,
    changes,
    get scheduled() {
      return scheduled;
    },
    get clock() {
      return clock;
    },
    setClock(value: number) {
      clock = value;
    },
    get cancelled() {
      return cancelled;
    },
    get visibilityRemovals() {
      return visibilityRemovals;
    },
    get focusRemovals() {
      return focusRemovals;
    },
    setDocumentVisible(value: boolean) {
      documentVisible = value;
    },
    fireVisibilityChange() {
      visibilityListener?.();
    },
    fireFocus() {
      focusListener?.();
    },
  };
}

test("the watcher updates the date when the midnight timer fires", () => {
  const harness = createHarness(Date.parse("2026-11-09T23:59:00.000Z"));

  expect(harness.watcher.date).toBe("2026-11-09");
  expect(harness.scheduled?.delay).toBe(60_000);

  harness.setClock(Date.parse("2026-11-10T00:00:00.000Z"));
  const timer = harness.scheduled;
  expect(timer).not.toBeNull();
  timer?.callback();

  expect(harness.changes).toEqual(["2026-11-10"]);
  expect(harness.watcher.date).toBe("2026-11-10");
  expect(harness.scheduled?.delay).toBe(DAY_MS);

  harness.watcher.stop();
});

test("focus and visible tab resume recheck a stale date", () => {
  const harness = createHarness(Date.parse("2026-11-09T23:59:00.000Z"));
  const initialCancelled = harness.cancelled;

  harness.setClock(Date.parse("2026-11-10T00:05:00.000Z"));
  harness.fireFocus();

  expect(harness.changes).toEqual(["2026-11-10"]);
  expect(harness.watcher.date).toBe("2026-11-10");
  expect(harness.cancelled).toBe(initialCancelled + 1);

  // Hidden tabs do not refresh, but becoming visible does.
  harness.setDocumentVisible(false);
  harness.setClock(Date.parse("2026-11-11T00:05:00.000Z"));
  harness.fireVisibilityChange();
  expect(harness.changes).toEqual(["2026-11-10"]);

  harness.setDocumentVisible(true);
  harness.fireVisibilityChange();
  expect(harness.changes).toEqual(["2026-11-10", "2026-11-11"]);
  expect(harness.watcher.date).toBe("2026-11-11");

  // Rechecking on the same UTC day does not emit a duplicate change.
  harness.fireFocus();
  expect(harness.changes).toEqual(["2026-11-10", "2026-11-11"]);

  harness.watcher.stop();
});

test("stopping the watcher cancels its timer and removes listeners", () => {
  const harness = createHarness(Date.parse("2026-11-09T12:00:00.000Z"));
  const pendingTimer = harness.scheduled;

  harness.setClock(Date.parse("2026-11-10T12:00:00.000Z"));
  harness.watcher.stop();

  expect(harness.cancelled).toBe(1);
  expect(harness.visibilityRemovals).toBe(1);
  expect(harness.focusRemovals).toBe(1);

  // A late timer or event after cleanup must not publish a new date.
  pendingTimer?.callback();
  harness.fireFocus();
  harness.fireVisibilityChange();
  expect(harness.changes).toEqual([]);
});
