// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadExportPng } from "./exportImage";

const appState = vi.hoisted(() => ({
  dbData: null as ArrayBuffer | null,
  engine: "sqlite" as "sqlite" | "postgresql",
  urlQuestion: null as string | null,
  pgFails: false,
  setEngine: vi.fn(),
  t: (key: string) => key,
  validateStatements: vi.fn(async () => null as string | null),
  exec: vi.fn(async () => [{ columns: ["id"], values: [[1]] }]),
  getViews: vi.fn(async () => [] as { name: string; query: string }[]),
  getSchema: vi.fn(async () => ({ Person: ["id"] })),
  questions: [{
    category_id: 1,
    display_number: 1,
    questions: [{ id: 1, description: "Find people", display_sequence: "A", result: { columns: ["id"], values: [[1]] } }],
  }],
}));

const selectedQuestion = {
  id: 1,
  description: "Find people",
  display_sequence: "A",
  category: { id: 1, display_number: "1" },
  result: { columns: ["id"], values: [[1]] },
  evaluable_result: { columns: ["id"], data: [[1]] },
};

vi.mock("./i18n/context", () => ({
  useLanguage: () => ({
    lang: "sv", engine: appState.engine, setEngine: appState.setEngine, t: appState.t,
    questions: appState.questions, dbData: appState.dbData, defaultQuery: "SELECT * FROM Person;",
  }),
  langKey: (lang: string, key: string) => lang + ":" + key,
  getUrlParam: (key: string) => key === "q" ? appState.urlQuestion : null,
  setUrlParam: vi.fn(),
}));
vi.mock("./useTheme", () => ({ default: () => ({ getTheme: () => "light", setTheme: vi.fn(), isDarkMode: () => false }) }));
vi.mock("./useEditorSettings", () => ({ useEditorSettings: () => ({ settings: { autocomplete: true, lineNumbers: false, highlightActiveLine: true, tabSize: 2 }, setSettings: vi.fn() }) }));
vi.mock("sql.js", () => ({
  default: vi.fn(async () => ({
    Database: class {
      create_function = vi.fn();
      exec = vi.fn();
    },
  })),
}));
vi.mock("./database/sqliteEngine", () => ({
  SqliteEngine: class {
    readonly engine = "sqlite" as const;
    exec = appState.exec;
    getViews = appState.getViews;
    getSchema = appState.getSchema;
    validateStatements = appState.validateStatements;
    getColumnNames = vi.fn(async () => ["id"]);
    close = vi.fn(async () => undefined);
  },
}));
vi.mock("@electric-sql/pglite", () => ({
  PGlite: class {
    constructor() { if (appState.pgFails) throw new Error("PGlite unavailable"); }
    exec = vi.fn();
    query = vi.fn();
    close = vi.fn();
  },
}));
vi.mock("./exportImage", () => ({
  renderExportSvg: vi.fn(() => ({ svg: "<svg/>", width: 1200, height: 400 })),
  downloadExportPng: vi.fn(async () => undefined),
}));
vi.mock("./QuestionSelector", () => ({
  default: ({ onSelect }: { onSelect: (question: typeof selectedQuestion) => void }) => <button onClick={() => onSelect(selectedQuestion)}>select-question</button>,
  getQuestion: () => selectedQuestion,
}));
function MockSqlEditor({ id, value, onChange }: { id?: string; value: string; onChange?: (value: string) => void }) {
  return <textarea aria-label={id} value={value} onChange={event => onChange?.(event.target.value)} />;
}
function MockViewsTable({
  views,
  onRemoveView,
  onViewRequest,
  onViewHideRequest,
  onViewExportRequest,
}: {
  views: { name: string }[];
  onRemoveView: (name: string) => void;
  onViewRequest: (name: string) => void;
  onViewHideRequest: () => void;
  onViewExportRequest: (name: string) => void;
}) {
  return <>{views.map(view => <div key={view.name}>
    <button onClick={() => onViewRequest(view.name)}>open-{view.name}</button>
    <button onClick={() => onViewHideRequest()}>hide-{view.name}</button>
    <button onClick={() => onRemoveView(view.name)}>delete-{view.name}</button>
    <button onClick={() => onViewExportRequest(view.name)}>export-{view.name}</button>
  </div>)}</>;
}
function MockExportSelectorModal({ onExport }: { onExport: (include: number[]) => void }) {
  return <button onClick={() => onExport([1])}>test-export-data</button>;
}
function MockImportDialog({ onMergeApply }: { onMergeApply: (data: {
  rawQueries: Record<string, string>;
  correctQueries: Record<string, string>;
  writtenQuestionIds: number[];
  correctQuestionIds: number[];
  views: { name: string; query: string }[];
  language: string;
  engine: string;
}) => void }) {
  return <button onClick={() => onMergeApply({
    rawQueries: { 1: "SELECT merged" }, correctQueries: { 1: "SELECT merged" },
    writtenQuestionIds: [1], correctQuestionIds: [1], views: [], language: "sv", engine: "sqlite",
  })}>test-apply-merge</button>;
}
vi.mock("./SqlEditor", () => ({
  default: MockSqlEditor,
}));
vi.mock("./ResultTable", () => ({ default: () => null }));
vi.mock("./ExportRenderer", async () => {
  const ReactModule = await import("react");
  const MockExportRenderer = ReactModule.forwardRef<HTMLDivElement>((_props, ref) => ReactModule.createElement("div", { ref, "data-testid": "export-renderer" }));
  MockExportRenderer.displayName = "MockExportRenderer";
  return { default: MockExportRenderer };
});
vi.mock("./ViewsTable", () => ({ default: MockViewsTable }));
vi.mock("./ra-engine/RAReference", () => ({ default: () => null }));
vi.mock("./ra-engine/RAPreview", () => ({ default: () => null }));
vi.mock("./ChangelogDialog", () => ({ default: () => null }));
vi.mock("./PrivacyNoticeToggle", () => ({ default: () => null }));
vi.mock("./LicenseDialog", () => ({ default: () => null }));
vi.mock("./ThemeToggle", () => ({ default: () => null }));
vi.mock("./DatabaseLayoutDialog", () => ({ default: () => null }));
vi.mock("./ExportSelectorModal", () => ({ default: MockExportSelectorModal }));
vi.mock("./ImportDialog", () => ({ default: MockImportDialog }));
vi.mock("./LanguageSelector", () => ({ default: () => null }));
vi.mock("./EngineSelector", () => ({ default: () => null }));
vi.mock("./EditorSettingsDialog", () => ({ default: () => null }));

import App from "./App";

afterEach(() => cleanup());
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  appState.dbData = null;
  appState.engine = "sqlite";
  appState.urlQuestion = null;
  appState.pgFails = false;
  appState.setEngine.mockClear();
  appState.validateStatements.mockReset();
  appState.validateStatements.mockResolvedValue(null);
  appState.exec.mockReset();
  appState.exec.mockResolvedValue([{ columns: ["id"], values: [[1]] }]);
  appState.getViews.mockReset();
  appState.getViews.mockResolvedValue([]);
  appState.getSchema.mockReset();
  appState.getSchema.mockResolvedValue({ Person: ["id"] });
  vi.mocked(downloadExportPng).mockClear();
  URL.createObjectURL = vi.fn(() => "blob:download");
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => { callback(0); return 1; }) as typeof window.requestAnimationFrame;
});

describe("App", () => {
  it("renders the initial state and switches between SQL and RA modes", () => {
    render(<App />);
    expect(screen.getByText("SQL Validator")).toBeTruthy();
    expect(screen.getByText("selectQuestion")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "editor" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "modeRA" }));
    expect(screen.getByRole("textbox", { name: "ra-editor" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "modeSQL" }));
    expect(screen.getByRole("textbox", { name: "editor" })).toBeTruthy();
  });

  it("loads the default query when a question is selected", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "select-question" }));
    expect(screen.getByText("question 1A")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "editor" }) as HTMLTextAreaElement).value).toBe("SELECT * FROM Person;");
  });

  it("initializes SQLite then validates, runs, and records a correct answer", async () => {
    appState.dbData = new ArrayBuffer(1);
    render(<App />);

    await waitFor(() => expect(appState.getSchema).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "select-question" }));
    await waitFor(() => expect(appState.validateStatements).toHaveBeenCalledWith("SELECT * FROM Person;"));

    fireEvent.click(screen.getByRole("button", { name: "runQuery" }));
    await waitFor(() => expect(appState.exec).toHaveBeenCalledWith("SELECT * FROM Person;"));
    expect(await screen.findByText("matchingResult")).toBeTruthy();
    expect(localStorage.getItem("sv:sqlite:correctQuestions")).toBe("[1]");
    expect(localStorage.getItem("sv:sqlite:correctQuestionId-1")).toBe("SELECT * FROM Person;");
  });

  it("shows validation and execution errors without running an invalid query", async () => {
    appState.dbData = new ArrayBuffer(1);
    appState.validateStatements.mockResolvedValueOnce("multiple_statements");
    render(<App />);
    await waitFor(() => expect(appState.getSchema).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "select-question" }));
    expect(await screen.findByText("multipleStatements")).toBeTruthy();
    expect(screen.getByRole("button", { name: "runQuery" }).hasAttribute("disabled")).toBe(true);

    appState.validateStatements.mockResolvedValue(null);
    fireEvent.change(screen.getByRole("textbox", { name: "editor" }), { target: { value: "SELECT broken" } });
    await waitFor(() => expect(screen.queryByText("multipleStatements")).toBeNull());
    appState.exec.mockRejectedValueOnce(new Error("database failure"));
    fireEvent.click(screen.getByRole("button", { name: "runQuery" }));
    expect(await screen.findByText("database failure")).toBeTruthy();
  });

  it("reports a wrong answer, restores a saved answer, and opens a view result", async () => {
    appState.dbData = new ArrayBuffer(1);
    appState.exec.mockResolvedValue([{ columns: ["id"], values: [[2]] }]);
    appState.getViews.mockResolvedValue([{ name: "people_view", query: "CREATE VIEW people_view AS SELECT 1" }]);
    localStorage.setItem("sv:sqlite:correctQuestionId-1", "SELECT id FROM Person");
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "open-people_view" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "select-question" }));
    fireEvent.click(screen.getByRole("button", { name: "runQuery" }));
    expect(await screen.findByText("wrongResult")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "editor" }), { target: { value: "SELECT another" } });
    expect(await screen.findByText("queryMismatch")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "loadSaved" }));
    expect((screen.getByRole("textbox", { name: "editor" }) as HTMLTextAreaElement).value).toBe("SELECT id FROM Person");

    fireEvent.click(screen.getByRole("button", { name: "open-people_view" }));
    await waitFor(() => expect(appState.exec).toHaveBeenCalledWith("SELECT * FROM people_view"));
    expect(await screen.findByText("viewLabel people_view")).toBeTruthy();
  });

  it("exports persisted progress and applies merged progress through its child controls", async () => {
    appState.dbData = new ArrayBuffer(1);
    localStorage.setItem("sv:sqlite:writtenQuestions", "[1]");
    localStorage.setItem("sv:sqlite:correctQuestions", "[1]");
    localStorage.setItem("sv:sqlite:questionId-1", "SELECT 1");
    localStorage.setItem("sv:sqlite:correctQuestionId-1", "SELECT 1");
    render(<App />);
    await waitFor(() => expect(appState.getSchema).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "test-export-data" }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "test-apply-merge" }));
    expect(localStorage.getItem("sv:sqlite:questionId-1")).toBe("SELECT merged");
    expect(localStorage.getItem("sv:sqlite:correctQuestionId-1")).toBe("SELECT merged");
  });

  it("persists a selected query while switching modes and restores a URL-selected question", () => {
    appState.urlQuestion = "1A";
    render(<App />);
    expect(screen.getByText("question 1A")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "editor" }), { target: { value: "SELECT custom" } });
    fireEvent.click(screen.getByRole("button", { name: "modeRA" }));
    expect(localStorage.getItem("sv:sqlite:questionId-1")).toBe("SELECT custom");
    expect((screen.getByRole("textbox", { name: "ra-editor" }) as HTMLTextAreaElement).value).toBe("");
  });

  it("falls back to SQLite with a visible error when PostgreSQL initialization fails", async () => {
    appState.dbData = "CREATE TABLE Person(id integer)" as unknown as ArrayBuffer;
    appState.engine = "postgresql";
    appState.pgFails = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<App />);
    expect(await screen.findByText("engineLoadFailed")).toBeTruthy();
    expect(appState.setEngine).toHaveBeenCalledWith("sqlite");
    consoleError.mockRestore();
  });

  it("recreates a stored view and exports matching query and view images", async () => {
    appState.dbData = new ArrayBuffer(1);
    localStorage.setItem("sv:sqlite:views", JSON.stringify([{ name: "saved_view", query: "CREATE VIEW saved_view AS SELECT 1" }]));
    appState.getViews.mockResolvedValueOnce([]).mockResolvedValue([{ name: "saved_view", query: "CREATE VIEW saved_view AS SELECT 1" }]);
    render(<App />);
    await waitFor(() => expect(appState.exec).toHaveBeenCalledWith("CREATE VIEW saved_view AS SELECT 1"));
    fireEvent.click(screen.getByRole("button", { name: "select-question" }));
    fireEvent.click(screen.getByRole("button", { name: "runQuery" }));
    expect(await screen.findByText("matchingResult")).toBeTruthy();

    fireEvent.pointerDown(screen.getByRole("button", { name: "actionsMenu" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByText("exportPng"));
    await waitFor(() => expect(downloadExportPng).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "export-saved_view" }));
    await waitFor(() => expect(downloadExportPng).toHaveBeenCalledTimes(2));
  });
});
