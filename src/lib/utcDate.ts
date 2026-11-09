import { formatDateOnly, todayUtcDay } from "../../convex/borrowDates";

const DAY_MS = 24 * 60 * 60 * 1_000;

export function utcDateFor(now = Date.now()): string {
  return formatDateOnly(todayUtcDay(now));
}

export function msUntilNextUtcMidnight(now = Date.now()): number {
  return (todayUtcDay(now) + 1) * DAY_MS - now;
}

type TimeoutHandle = ReturnType<typeof setTimeout>;

export interface UtcDateWatcherOptions<Handle = TimeoutHandle> {
  onChange: (date: string) => void;
  now?: () => number;
  schedule?: (callback: () => void, delay: number) => Handle;
  cancel?: (handle: Handle) => void;
  addVisibilityListener?: (listener: () => void) => void;
  removeVisibilityListener?: (listener: () => void) => void;
  addFocusListener?: (listener: () => void) => void;
  removeFocusListener?: (listener: () => void) => void;
  isVisible?: () => boolean;
}

// Watches the UTC calendar date without polling. One timer is scheduled for
// the next midnight; visibility and focus events also recheck in case a
// background tab suspended or delayed the timer.
export function createUtcDateWatcher<Handle = TimeoutHandle>(
  options: UtcDateWatcherOptions<Handle>,
) {
  const now = options.now ?? Date.now;
  const schedule =
    options.schedule ??
    ((callback: () => void, delay: number) =>
      setTimeout(callback, delay) as Handle);
  const cancel =
    options.cancel ??
    ((handle: Handle) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>));
  const addVisibilityListener =
    options.addVisibilityListener ??
    ((listener: () => void) =>
      document.addEventListener("visibilitychange", listener));
  const removeVisibilityListener =
    options.removeVisibilityListener ??
    ((listener: () => void) =>
      document.removeEventListener("visibilitychange", listener));
  const addFocusListener =
    options.addFocusListener ??
    ((listener: () => void) => window.addEventListener("focus", listener));
  const removeFocusListener =
    options.removeFocusListener ??
    ((listener: () => void) => window.removeEventListener("focus", listener));
  const isVisible =
    options.isVisible ?? (() => document.visibilityState === "visible");

  let current = utcDateFor(now());
  let timer: Handle | null = null;
  let stopped = false;

  function check() {
    if (stopped) return;

    const next = utcDateFor(now());
    if (next !== current) {
      current = next;
      options.onChange(next);
    }
  }

  function scheduleNextMidnight() {
    if (stopped) return;

    if (timer !== null) {
      cancel(timer);
    }
    timer = schedule(() => {
      timer = null;
      check();
      scheduleNextMidnight();
    }, msUntilNextUtcMidnight(now()));
  }

  function handleVisibilityChange() {
    if (!isVisible()) return;
    check();
    scheduleNextMidnight();
  }

  function handleFocus() {
    check();
    scheduleNextMidnight();
  }

  addVisibilityListener(handleVisibilityChange);
  addFocusListener(handleFocus);
  scheduleNextMidnight();

  return {
    get date() {
      return current;
    },
    check,
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
      removeVisibilityListener(handleVisibilityChange);
      removeFocusListener(handleFocus);
    },
  };
}
