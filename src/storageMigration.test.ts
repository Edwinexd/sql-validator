// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { migrateLegacySqliteStorage } from "./storageMigration";

afterEach(() => localStorage.clear());

describe("migrateLegacySqliteStorage", () => {
  it("moves unnamespaced SQLite progress into the keys the app reads", () => {
    localStorage.setItem("writtenQuestions", "[3]");
    localStorage.setItem("questionId-3", "SELECT 3");
    localStorage.setItem("correctQuestions", "[3]");
    localStorage.setItem("correctQuestionId-3", "SELECT 3");
    localStorage.setItem("views", "[]");

    migrateLegacySqliteStorage();

    expect(localStorage.getItem("sv:sqlite:writtenQuestions")).toBe("[3]");
    expect(localStorage.getItem("sv:sqlite:questionId-3")).toBe("SELECT 3");
    expect(localStorage.getItem("sv:sqlite:correctQuestions")).toBe("[3]");
    expect(localStorage.getItem("sv:sqlite:correctQuestionId-3")).toBe("SELECT 3");
    expect(localStorage.getItem("sv:sqlite:views")).toBe("[]");
  });

  it("also repairs the sv:-only keys created by the prior migration", () => {
    localStorage.setItem("sv:writtenQuestions", "[8]");
    localStorage.setItem("sv:questionId-8", "SELECT 8");

    migrateLegacySqliteStorage();

    expect(localStorage.getItem("sv:sqlite:writtenQuestions")).toBe("[8]");
    expect(localStorage.getItem("sv:sqlite:questionId-8")).toBe("SELECT 8");
  });

  it("does not overwrite existing engine-namespaced progress", () => {
    localStorage.setItem("sv:sqlite:writtenQuestions", "[2]");
    localStorage.setItem("writtenQuestions", "[3]");

    migrateLegacySqliteStorage();

    expect(localStorage.getItem("sv:sqlite:writtenQuestions")).toBe("[2]");
  });
});
