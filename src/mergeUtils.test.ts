// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { getLocalData, parseQuestionIdList } from "./mergeUtils";

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
});
