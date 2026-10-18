import { describe, expect, it } from "vitest";
import { formatUpdated } from "./time";

const now = new Date("2026-10-18T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("formatUpdated", () => {
  it.each([
    [ago(10_000), "Just now"],
    [ago(5 * 60_000), "5 min ago"],
    [ago(3 * 3_600_000), "3 h ago"],
    [ago(30 * 3_600_000), "Yesterday"],
    ["2026-10-02T09:00:00+00:00", "Oct 2, 2026"],
    ["not a date", ""],
  ])("%s → %s", (iso, expected) => {
    expect(formatUpdated(iso, now)).toBe(expected);
  });
});
