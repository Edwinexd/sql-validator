// @vitest-environment jsdom
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChangelogDialog from "./ChangelogDialog";
import LicenseDialog from "./LicenseDialog";
import ExportRenderer from "./ExportRenderer";
import ExportSelectorModal, { ExportSelectorModalHandle } from "./ExportSelectorModal";
import EditorSettingsDialog from "./EditorSettingsDialog";
import EngineSelector from "./EngineSelector";
import LanguageSelector from "./LanguageSelector";
import PrivacyNoticeToggle from "./PrivacyNoticeToggle";

const languageState = vi.hoisted(() => ({
  setLang: vi.fn(),
  setEngine: vi.fn(),
  t: (key: string, params?: Record<string, string>) => params ? `${key}:${Object.values(params).join("")}` : key,
  questions: [{
    category_id: 1,
    display_number: 1,
    questions: [{ id: 7, display_sequence: "A", result: { columns: ["id"], values: [[1]] } }],
  }],
}));

vi.mock("./i18n/context", () => ({
  useLanguage: () => ({
    lang: "sv",
    engine: "sqlite",
    setLang: languageState.setLang,
    setEngine: languageState.setEngine,
    t: languageState.t,
    questions: languageState.questions,
  }),
}));
vi.mock("./SqlEditor", () => ({ default: ({ value }: { value: string }) => <pre data-testid="sql-editor">{value}</pre> }));
vi.mock("./ResultTable", () => ({ default: ({ result }: { result: { columns: string[] } }) => <div data-testid="result">{result.columns.join(",")}</div> }));
vi.mock("./ra-engine/RAPreview", () => ({ renderRAPreview: (code: string) => `<em>${code}</em>` }));

afterEach(() => cleanup());
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("static dialogs", () => {
  it("marks a new changelog as seen and opens its content", () => {
    localStorage.setItem("changelog-last-seen", "1900-01-01");
    render(<ChangelogDialog />);
    const trigger = screen.getByRole("button", { name: "changelog!" });
    expect(trigger.textContent).toContain("!");
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(localStorage.getItem("changelog-last-seen")).not.toBe("1900-01-01");
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("loads dependency licenses and keeps the project licenses visible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => [{ name: "sql.js", version: "1.0.0", license: "MIT", repository: "https://example.test/sqljs" }],
    }));
    render(<LicenseDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Licenses" }));
    expect(screen.getByText("sql-validator (core)")).toBeTruthy();
    expect(await screen.findByText("sql.js")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("handles a failed license fetch without leaving the dialog", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<LicenseDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Licenses" }));
    await waitFor(() => expect(screen.getByText("Loading...")).toBeTruthy());
  });

  it("updates each editor setting from its dialog", () => {
    const onSettingsChange = vi.fn();
    render(<EditorSettingsDialog settings={{ autocomplete: true, lineNumbers: false, highlightActiveLine: true, tabSize: 2 }} onSettingsChange={onSettingsChange} />);
    fireEvent.click(screen.getByRole("button", { name: "editorSettings" }));
    fireEvent.click(screen.getByLabelText("settingAutocomplete"));
    fireEvent.click(screen.getByLabelText("settingLineNumbers"));
    fireEvent.click(screen.getByLabelText("settingHighlightActiveLine"));
    expect(onSettingsChange).toHaveBeenCalledWith({ autocomplete: false });
    expect(onSettingsChange).toHaveBeenCalledWith({ lineNumbers: true });
    expect(onSettingsChange).toHaveBeenCalledWith({ highlightActiveLine: false });
  });

  it("does not render the privacy notice when analytics is disabled", () => {
    const { container } = render(<PrivacyNoticeToggle />);
    expect(container.innerHTML).toBe("");
  });
});

describe("language and engine selectors", () => {
  it("offers all registered choices and applies a selected value", () => {
    const { rerender } = render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "English" }));
    expect(languageState.setLang).toHaveBeenCalledWith("en");

    rerender(<EngineSelector />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "PostgreSQL" }));
    expect(languageState.setEngine).toHaveBeenCalledWith("postgresql");
  });
});

describe("export components", () => {
  const question = {
    id: 7,
    description: "Find people",
    display_sequence: "A",
    category: { id: 1, display_number: "1" },
    result: { columns: ["id"], values: [[1]] },
    evaluable_result: { columns: ["id"], data: [[1]] },
  };

  it("renders SQL, relational algebra, and view export payloads", () => {
    const { rerender } = render(<ExportRenderer query={{ question, isCorrect: true, code: "select id from person", result: { columns: ["id"], data: [[1]] } }} />);
    expect(screen.getByText("Find people")).toBeTruthy();
    expect(screen.getByText("exportMatches")).toBeTruthy();
    expect(screen.getByTestId("sql-editor").textContent).toContain("SELECT");

    rerender(<ExportRenderer query={{ question, isCorrect: false, mode: "ra", code: "π[id](Person)", result: { columns: ["id"], data: [[1]] } }} />);
    expect(screen.getByText("exportDoesNotMatch")).toBeTruthy();
    expect(screen.getByText("π[id](Person)")).toBeTruthy();

    rerender(<ExportRenderer view={{ view: { name: "people_view", query: "select id from person" }, result: { columns: ["id"], data: [[1]] } }} />);
    expect(screen.getByText("people_view")).toBeTruthy();
    expect(screen.getByText("exportViewResultLabel:people_view")).toBeTruthy();
  });

  it("does not render ambiguous or absent export data", () => {
    const { container, rerender } = render(<ExportRenderer />);
    expect(container.innerHTML).toBe("");
    rerender(<ExportRenderer query={{ question, isCorrect: true, code: "SELECT 1", result: { columns: [], data: [] } }} view={{ view: { name: "v", query: "SELECT 1" }, result: { columns: [], data: [] } }} />);
    expect(container.innerHTML).toBe("");
  });

  it("exports all or selected correct questions through its imperative dialog", () => {
    const onExport = vi.fn();
    const ref = createRef<ExportSelectorModalHandle>();
    render(<ExportSelectorModal ref={ref} correctQuestions={[7]} onExport={onExport} />);
    act(() => ref.current!.openDialog());
    fireEvent.click(screen.getByRole("button", { name: "exportAll" }));
    expect(onExport).toHaveBeenCalledWith([7]);

    act(() => ref.current!.openDialog());
    fireEvent.click(screen.getByLabelText("includeAllQuestions"));
    expect(screen.getByText("1A")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("1A"));
    fireEvent.click(screen.getByRole("button", { name: "exportSelected" }));
    expect(onExport).toHaveBeenLastCalledWith([]);
  });
});
