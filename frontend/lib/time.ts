const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** When something was last changed, relative to `now`: "Just now", "5 min ago", "3 h ago", "Yesterday" or "Oct 2, 2026". */
export function formatUpdated(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const elapsed = now.getTime() - then.getTime();
  if (Number.isNaN(elapsed)) return "";
  if (elapsed < MINUTE) return "Just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  if (elapsed < 2 * DAY) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(then);
}
