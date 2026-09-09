import { describe, expect, it } from "vitest";
import { normalizePgValue } from "./pgNormalize";

describe("normalizePgValue", () => {
  it("normalizes dates, booleans, numeric PostgreSQL types, and nullish values", () => {
    expect(normalizePgValue(new Date("2025-02-03T12:00:00Z"))).toBe("2025-02-03");
    expect(normalizePgValue(true)).toBe(1);
    expect(normalizePgValue(false)).toBe(0);
    expect(normalizePgValue("42.5", 1700)).toBe(42.5);
    expect(normalizePgValue("42", 20)).toBe(42);
    expect(normalizePgValue(null)).toBeNull();
    expect(normalizePgValue(undefined)).toBeNull();
  });

  it("preserves text-like values and invalid numeric strings", () => {
    expect(normalizePgValue("00123", 25)).toBe("00123");
    expect(normalizePgValue("not a number", 1700)).toBe("not a number");
    expect(normalizePgValue(123n)).toBe(123);
    expect(normalizePgValue(" ", 1700)).toBe(" ");
  });
});
