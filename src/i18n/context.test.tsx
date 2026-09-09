// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider, useLanguage } from "./context";

function Consumer() {
  const { lang, engine, questions, defaultQuery, dbData, setLang, setEngine, t } = useLanguage();
  return (
    <div>
      <span data-testid="state">{`${lang}/${engine}/${questions.length}/${defaultQuery}/${typeof dbData}`}</span>
      <span data-testid="translation">{t("runQuery")}</span>
      <button onClick={() => setLang("de")}>language</button>
      <button onClick={() => setEngine("postgresql")}>engine</button>
      <button onClick={() => setLang("invalid")}>invalid-language</button>
    </div>
  );
}

function renderProvider() {
  return render(<LanguageProvider><Consumer /></LanguageProvider>);
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("questionpool.json")) {
      return { ok: true, json: async () => ({ questions: [{ category_id: 1 }], defaultQuery: "SELECT test" }) };
    }
    if (url.endsWith("data.sql")) {
      return { ok: true, text: async () => "CREATE TABLE test ();" };
    }
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LanguageProvider", () => {
  it("uses valid URL state and loads PostgreSQL language resources", async () => {
    window.history.replaceState({}, "", "/?lang=en&engine=postgresql");
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("en/postgresql/1/SELECT test/string"));
    expect(fetch).toHaveBeenCalledWith("/languages/en-pg/questionpool.json");
    expect(fetch).toHaveBeenCalledWith("/languages/en-pg/data.sql");
  });

  it("persists selection changes and updates the URL", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("state").textContent).toContain("sv/sqlite/1"));

    await act(async () => screen.getByRole("button", { name: "language" }).click());
    expect(localStorage.getItem("language")).toBe("de");
    expect(window.location.search).toContain("lang=de");

    await act(async () => screen.getByRole("button", { name: "engine" }).click());
    expect(localStorage.getItem("engine")).toBe("postgresql");
    expect(window.location.search).toContain("engine=postgresql");

    await act(async () => screen.getByRole("button", { name: "invalid-language" }).click());
    expect(screen.getByTestId("state").textContent).toContain("de/postgresql");
  });

  it("uses valid stored preferences when URLs are absent", async () => {
    localStorage.setItem("language", "en");
    localStorage.setItem("engine", "postgresql");
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("state").textContent).toContain("en/postgresql/1"));
  });

  it("keeps the prior empty data state when a resource request fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderProvider();

    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.getByTestId("state").textContent).toBe("sv/sqlite/0/SELECT * FROM Student;/object");
    error.mockRestore();
  });
});
