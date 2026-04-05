import { describe, expect, it } from "vitest";
import {
  BIWEEKLY_PER_MONTH,
  splitSafeToSpend,
  WEEKS_PER_MONTH,
} from "./period-splits";

describe("splitSafeToSpend", () => {
  it("returns zeros for null, undefined, or non-positive safe amounts", () => {
    expect(splitSafeToSpend(null)).toEqual({
      weekly: 0,
      biWeekly: 0,
      monthly: 0,
      quarterly: 0,
      yearly: 0,
    });
    expect(splitSafeToSpend(undefined)).toEqual({
      weekly: 0,
      biWeekly: 0,
      monthly: 0,
      quarterly: 0,
      yearly: 0,
    });
    expect(splitSafeToSpend(0)).toEqual({
      weekly: 0,
      biWeekly: 0,
      monthly: 0,
      quarterly: 0,
      yearly: 0,
    });
    expect(splitSafeToSpend(-10)).toEqual({
      weekly: 0,
      biWeekly: 0,
      monthly: 0,
      quarterly: 0,
      yearly: 0,
    });
  });

  it("splits a positive monthly safe-to-spend into derived periods", () => {
    const safe = 4345;
    const s = splitSafeToSpend(safe);
    expect(s.monthly).toBe(safe);
    expect(s.weekly).toBeCloseTo(safe / WEEKS_PER_MONTH, 5);
    expect(s.biWeekly).toBeCloseTo(safe / BIWEEKLY_PER_MONTH, 5);
    expect(s.quarterly).toBe(safe * 3);
    expect(s.yearly).toBe(safe * 12);
  });
});
