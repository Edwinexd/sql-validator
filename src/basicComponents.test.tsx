// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ResultTable from "./ResultTable";
import ThemeToggle from "./ThemeToggle";
import ViewsTable from "./ViewsTable";

vi.mock("./i18n/context", () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, number>) => params ? `${key}:${params.count}` : key,
  }),
}));

afterEach(() => cleanup());

describe("ResultTable", () => {
  it("renders empty, null, truncated, and fixed-size results", () => {
    const { rerender } = render(<ResultTable result={{ columns: [], data: [] }} />);
    expect(screen.getByText("noResults")).toBeTruthy();

    rerender(<ResultTable forceLight forceFixedSizes result={{ columns: ["id"], data: [[null], [1]] }} />);
    expect(screen.getByTitle("nullTooltip")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();

    rerender(<ResultTable result={{ columns: ["id"], data: Array.from({ length: 101 }, (_, i) => [i]) }} />);
    expect(screen.getByText("moreRows:1")).toBeTruthy();
  });
});

describe("ThemeToggle", () => {
  it("renders the correct icon state and toggles the requested theme", () => {
    const setTheme = vi.fn();
    const { rerender } = render(<ThemeToggle setTheme={setTheme} isDarkMode={() => false} />);
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("dark");

    rerender(<ThemeToggle setTheme={setTheme} isDarkMode={() => true} />);
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenLastCalledWith("light");
  });
});

describe("ViewsTable", () => {
  it("requests, hides, exports, and deletes views", () => {
    const onRequest = vi.fn();
    const onHide = vi.fn();
    const onExport = vi.fn();
    const onRemove = vi.fn();
    const props = {
      views: [{ name: "recent", query: "SELECT 1" }],
      currentlyQuriedView: null,
      onViewRequest: onRequest,
      onViewHideRequest: onHide,
      onViewExportRequest: onExport,
      onRemoveView: onRemove,
    };
    const { rerender } = render(<ViewsTable {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "recent" }));
    fireEvent.click(screen.getByRole("button", { name: /exportPng/ }));
    fireEvent.click(screen.getByRole("button", { name: /deleteView/ }));
    expect(onRequest).toHaveBeenCalledWith("recent");
    expect(onExport).toHaveBeenCalledWith("recent");
    expect(onRemove).toHaveBeenCalledWith("recent");

    rerender(<ViewsTable {...props} currentlyQuriedView="recent" />);
    fireEvent.click(screen.getByRole("button", { name: "recent" }));
    expect(onHide).toHaveBeenCalled();
  });
});
