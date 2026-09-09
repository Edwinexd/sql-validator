import { describe, expect, it } from "vitest";
import { isCorrectResult, type Result } from "./utils";

const result = (columns: string[], data: Result["data"]): Result => ({ columns, data });

describe("isCorrectResult", () => {
  it("matches rows regardless of row order", () => {
    const expected = result(["id", "name"], [[1, "Ada"], [2, "Grace"]]);
    const actual = result(["id", "name"], [[2, "Grace"], [1, "Ada"]]);

    expect(isCorrectResult(expected, actual)).toBe(true);
  });

  it("accepts a consistent column permutation across every row", () => {
    const expected = result(["id", "name"], [[1, "Ada"], [2, "Grace"]]);
    const actual = result(["name", "id"], [["Grace", 2], ["Ada", 1]]);

    expect(isCorrectResult(expected, actual)).toBe(true);
  });

  it("treats column names as labels rather than result values", () => {
    expect(isCorrectResult(
      result(["id"], [[1]]),
      result(["wrong_name"], [[1]])
    )).toBe(true);
  });

  it("rejects incompatible row values and column counts", () => {
    expect(isCorrectResult(result(["id"], [[1]]), result(["id"], [[2]]))).toBe(false);
    expect(isCorrectResult(result(["id"], [[1]]), result(["id", "name"], [[1, "Ada"]]))).toBe(false);
  });

  it("compares duplicate, null, and binary values without hash-only collisions", () => {
    expect(isCorrectResult(result(["value"], [[1], [1], [null]]), result(["value"], [[null], [1], [1]]))).toBe(true);
    expect(isCorrectResult(
      result(["data"], [[new Uint8Array([1, 2])]]),
      result(["data"], [[new Uint8Array([1, 2])]])
    )).toBe(true);
    expect(isCorrectResult(
      result(["data"], [[new Uint8Array([1, 2])]]),
      result(["data"], [[new Uint8Array([2, 1])]])
    )).toBe(false);
  });

  it("handles negative numeric values when assigning hash buckets", () => {
    expect(isCorrectResult(result(["value"], [[-20]]), result(["renamed"], [[-20]]))).toBe(true);
  });
});
