import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeToDateChange, todayIso } from "./today";

describe("todayIso", () => {
  it("uses the local date", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("subscribeToDateChange", () => {
  const listeners = new Map<string, () => void>();
  const target = {
    addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("document", target);
    vi.stubGlobal("window", target);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    listeners.clear();
  });

  it("notifies just after each local midnight", () => {
    vi.setSystemTime(new Date(2026, 9, 17, 23, 55));
    const onChange = vi.fn();
    const unsubscribe = subscribeToDateChange(onChange);

    vi.advanceTimersByTime(4 * 60_000);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2 * 60_000);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(todayIso()).toBe("2026-10-18");

    vi.advanceTimersByTime(24 * 60 * 60_000);
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    vi.advanceTimersByTime(24 * 60 * 60_000);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(listeners.size).toBe(0);
  });

  it("checks again when the user returns to the page", () => {
    const onChange = vi.fn();
    subscribeToDateChange(onChange);
    listeners.get("visibilitychange")?.();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
