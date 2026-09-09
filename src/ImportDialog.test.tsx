// @vitest-environment jsdom
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ImportDialog, { ImportDialogHandle } from "./ImportDialog";
import type { MergeAnalysis, ParsedSaveData } from "./mergeUtils";

vi.mock("./i18n/context", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    lang: "sv",
    engine: "sqlite",
    questions: [{
      category_id: 1,
      display_number: 1,
      questions: [{ id: 7, display_sequence: "A", result: { columns: ["id"], values: [[1]] } }],
    }],
  }),
}));

const imported: ParsedSaveData = {
  language: "en",
  engine: "postgresql",
  rawQueries: { 7: "SELECT imported" },
  correctQueries: { 7: "SELECT imported" },
  writtenQuestionIds: [7],
  correctQuestionIds: [7],
  views: [{ name: "imported_view", query: "SELECT 1" }],
};

const emptyAnalysis: MergeAnalysis = {
  addRawQueries: { 7: "SELECT imported" },
  addCorrectQueries: { 7: "SELECT imported" },
  addViews: [{ name: "imported_view", query: "SELECT 1" }],
  keepRawQueries: {}, keepCorrectQueries: {}, keepViews: [], conflicts: [], identicalCount: 1,
};

afterEach(() => cleanup());

describe("ImportDialog", () => {
  function setup(analysis: MergeAnalysis) {
    const ref = createRef<ImportDialogHandle>();
    const onOverwrite = vi.fn();
    const onMergeApply = vi.fn();
    render(<ImportDialog ref={ref} importedData={imported} onOverwrite={onOverwrite} onMergeApply={onMergeApply} />);
    act(() => ref.current!.open(analysis));
    return { ref, onOverwrite, onMergeApply };
  }

  it("reports mismatched save metadata and applies an automatic merge", () => {
    const { onMergeApply } = setup(emptyAnalysis);
    expect(screen.getByText("languageMismatchWarning")).toBeTruthy();
    expect(screen.getByText("engineMismatchWarning")).toBeTruthy();
    expect(screen.getByText(/3 newCount/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "merge" }));
    expect(onMergeApply).toHaveBeenCalledWith(expect.objectContaining({
      rawQueries: { 7: "SELECT imported" },
      correctQueries: { 7: "SELECT imported" },
      views: [{ name: "imported_view", query: "SELECT 1" }],
    }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("requires every conflict to be resolved before applying the merge", () => {
    const analysis: MergeAnalysis = {
      ...emptyAnalysis,
      addRawQueries: {},
      addCorrectQueries: {},
      addViews: [],
      conflicts: [
        { type: "rawQuery", key: "7", localValue: "SELECT local", importedValue: "SELECT imported" },
        { type: "view", key: "people", localValue: "SELECT local", importedValue: "SELECT imported" },
      ],
    };
    const { onMergeApply } = setup(analysis);
    fireEvent.click(screen.getByRole("button", { name: "merge" }));
    expect(screen.getByText("question 1A")).toBeTruthy();
    expect(screen.getByText('viewLabel "people"')).toBeTruthy();
    expect(screen.getByRole("button", { name: "applyMerge" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getAllByLabelText("keepImported")[0]);
    fireEvent.click(screen.getAllByLabelText("keepLocal")[1]);
    expect(screen.getByRole("button", { name: "applyMerge" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "applyMerge" }));
    expect(onMergeApply).toHaveBeenCalledWith(expect.objectContaining({
      rawQueries: { 7: "SELECT imported" },
      views: [{ name: "people", query: "SELECT local" }],
    }));
  });

  it("can overwrite or close through the imperative handle", () => {
    const { ref, onOverwrite } = setup(emptyAnalysis);
    fireEvent.click(screen.getByRole("button", { name: "overwriteAll" }));
    expect(onOverwrite).toHaveBeenCalledTimes(1);
    act(() => ref.current!.open(emptyAnalysis));
    act(() => ref.current!.close());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
