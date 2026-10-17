// The Effective Date defaults to the user's local date, which has to move on at midnight
// even if the page is left open without being edited.

export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Calls `onChange` when the local date may have changed. For useSyncExternalStore. */
export function subscribeToDateChange(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const scheduleNextMidnight = () => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    // A second late, so the new date is in effect when the timer fires.
    timer = setTimeout(() => {
      onChange();
      scheduleNextMidnight();
    }, nextMidnight.getTime() - now.getTime() + 1000);
  };
  scheduleNextMidnight();
  // Timers don't run while a computer sleeps, so check again when the user comes back.
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("focus", onChange);
  };
}
