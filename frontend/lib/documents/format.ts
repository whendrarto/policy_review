const MIN_YEARS = 1;
const MAX_YEARS = 99;

export function isValidYears(years: unknown): years is number {
  return typeof years === "number" && Number.isInteger(years) && years >= MIN_YEARS && years <= MAX_YEARS;
}

/** "2026-01-01" → "January 1, 2026"; "" for anything that isn't a real calendar date. */
export function formatDate(isoDate: string): string {
  // Date inputs allow years beyond 9999, so show those rather than treating them as blank.
  const match = /^(\d{4,6})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return "";
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls over impossible dates (Feb 31 → Mar 3) and maps years below 100 to 19xx.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date);
}
