// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  buildMergedData,
  detectConflicts,
  getLocalData,
  parseImportFile,
  parseQuestionIdList,
  type ParsedSaveData,
} from "./mergeUtils";

afterEach(() => localStorage.clear());

describe("getLocalData", () => {
  it("keeps PostgreSQL and SQLite progress isolated", () => {
    localStorage.setItem("sv:sqlite:writtenQuestions", "[1]");
    localStorage.setItem("sv:sqlite:questionId-1", "SELECT 'sqlite'");
    localStorage.setItem("sv:postgresql:writtenQuestions", "[2]");
    localStorage.setItem("sv:postgresql:questionId-2", "SELECT 'postgresql'");

    const postgresql = getLocalData("sv", "postgresql");

    expect(postgresql.writtenQuestionIds).toEqual([2]);
    expect(postgresql.rawQueries).toEqual({ 2: "SELECT 'postgresql'" });
  });

  it("treats malformed persisted data as empty instead of throwing", () => {
    localStorage.setItem("sv:sqlite:writtenQuestions", "not json");
    localStorage.setItem("sv:sqlite:views", "{}");

    expect(parseQuestionIdList("not json")).toEqual([]);
    expect(getLocalData("sv", "sqlite")).toMatchObject({
      writtenQuestionIds: [],
      views: [],
    });
  });

  it("rejects non-integer ids and reads only present query values", () => {
    localStorage.setItem("sv:sqlite:writtenQuestions", "[1, \"2\"]");
    localStorage.setItem("sv:sqlite:correctQuestions", "[]");

    expect(parseQuestionIdList(null)).toEqual([]);
    expect(parseQuestionIdList("{}" )).toEqual([]);
    expect(parseQuestionIdList("[1, \"2\"]")).toEqual([]);
    expect(getLocalData("sv", "sqlite").rawQueries).toEqual({});
  });
});

describe("parseImportFile", () => {
  it("parses the structured save format, including escaped comment endings and views", () => {
    const data = `/* --- BEGIN Save Language --- */
-- en
/* --- END Save Language --- */
/* --- BEGIN Save Engine --- */
-- postgresql
/* --- END Save Engine --- */
/* --- BEGIN Raw Queries --- */
/*
{"1":"SELECT '\\*/'"}
*/
/* --- END Raw Queries --- */
/* --- BEGIN Correct Raw Queries --- */
/*
{"1":"SELECT 1"}
*/
/* --- END Correct Raw Queries --- */
/* --- BEGIN Raw List Dumps --- */
-- [1]
-- [1]
/* --- END Raw List Dumps --- */
/* --- BEGIN Views --- */
/* --- BEGIN View active_users --- */
CREATE VIEW active_users AS SELECT 1;
/* --- END View active_users --- */
/* --- END Views --- */`;

    expect(parseImportFile(data)).toEqual({
      language: "en",
      engine: "postgresql",
      rawQueries: { 1: "SELECT '*/'" },
      correctQueries: { 1: "SELECT 1" },
      writtenQuestionIds: [1],
      correctQuestionIds: [1],
      views: [{ name: "active_users", query: "CREATE VIEW active_users AS SELECT 1;" }],
    });
  });

  it("uses backwards-compatible language and engine defaults", () => {
    expect(parseImportFile("-- Language: de\nSELECT 1")).toMatchObject({
      language: "de",
      engine: "sqlite",
      rawQueries: {},
      correctQueries: {},
      writtenQuestionIds: [],
      correctQuestionIds: [],
      views: [],
    });
  });
});

describe("merge analysis and application", () => {
  const local: ParsedSaveData = {
    language: "sv",
    engine: "sqlite",
    rawQueries: { 1: "SELECT local", 2: "SELECT same;", 3: "SELECT old" },
    correctQueries: { 1: "SELECT local", 2: "SELECT same;", 3: "SELECT old", 4: "SELECT old correct" },
    writtenQuestionIds: [1, 2, 3],
    correctQuestionIds: [1, 2, 3, 4],
    views: [
      { name: "local_only", query: "SELECT 1" },
      { name: "same_view", query: "SELECT 2;" },
      { name: "changed_view", query: "SELECT old" },
    ],
  };
  const imported: ParsedSaveData = {
    language: "en",
    engine: "postgresql",
    rawQueries: { 2: "SELECT same", 3: "SELECT new", 5: "SELECT imported" },
    correctQueries: { 2: "SELECT same", 3: "SELECT new", 4: "SELECT new correct", 5: "SELECT imported" },
    writtenQuestionIds: [2, 3, 5],
    correctQuestionIds: [2, 3, 4, 5],
    views: [
      { name: "same_view", query: "SELECT 2" },
      { name: "changed_view", query: "SELECT new" },
      { name: "imported_only", query: "SELECT 3" },
    ],
  };

  it("separates identical, added, retained, and conflicting entries", () => {
    const analysis = detectConflicts(local, imported);

    expect(analysis.keepRawQueries).toEqual({ 1: "SELECT local" });
    expect(analysis.addRawQueries).toEqual({ 5: "SELECT imported" });
    expect(analysis.keepCorrectQueries).toEqual({ 1: "SELECT local" });
    expect(analysis.addCorrectQueries).toEqual({ 4: "SELECT new correct", 5: "SELECT imported" });
    expect(analysis.keepViews).toEqual([{ name: "local_only", query: "SELECT 1" }]);
    expect(analysis.addViews).toEqual([{ name: "imported_only", query: "SELECT 3" }]);
    expect(analysis.identicalCount).toBe(3);
    expect(analysis.conflicts).toEqual([
      { type: "rawQuery", key: "3", localValue: "SELECT old", importedValue: "SELECT new" },
      { type: "view", key: "changed_view", localValue: "SELECT old", importedValue: "SELECT new" },
    ]);
  });

  it("applies conflict resolutions and retains the local save metadata", () => {
    const analysis = detectConflicts(local, imported);
    const merged = buildMergedData(local, imported, analysis, {
      "rawQuery:3": "imported",
      "view:changed_view": "local",
    });

    expect(merged).toMatchObject({
      language: "sv",
      engine: "sqlite",
      rawQueries: {
        1: "SELECT local",
        2: "SELECT same;",
        3: "SELECT new",
        5: "SELECT imported",
      },
      correctQueries: {
        1: "SELECT local",
        2: "SELECT same;",
        3: "SELECT new",
        4: "SELECT new correct",
        5: "SELECT imported",
      },
    });
    expect(merged.writtenQuestionIds.sort()).toEqual([1, 2, 3, 5]);
    expect(merged.correctQuestionIds.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(merged.views).toEqual([
      { name: "same_view", query: "SELECT 2;" },
      { name: "local_only", query: "SELECT 1" },
      { name: "imported_only", query: "SELECT 3" },
      { name: "changed_view", query: "SELECT old" },
    ]);
  });

  it("uses local values when a conflict is not explicitly resolved", () => {
    const merged = buildMergedData(local, imported, detectConflicts(local, imported), {});
    expect(merged.rawQueries[3]).toBe("SELECT old");
    expect(merged.correctQueries[3]).toBe("SELECT old");
  });
});
