// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DatabaseLayoutDialog from "./DatabaseLayoutDialog";

vi.mock("./i18n/context", () => ({
  useLanguage: () => ({
    lang: "en",
    engine: "sqlite",
    t: (key: string) => key,
  }),
}));

describe("DatabaseLayoutDialog", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    window.open = vi.fn();
  });

  it("opens the generated language-specific SVG on small screens", () => {
    render(<DatabaseLayoutDialog isDarkMode={() => false} />);

    fireEvent.click(screen.getByRole("button", { name: "openDatabaseLayout" }));

    expect(window.open).toHaveBeenCalledWith("/languages/en/db_layout_light.svg", "_blank");
  });

  it("opens and closes the dialog on larger screens", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    render(<DatabaseLayoutDialog isDarkMode={() => true} />);

    fireEvent.click(screen.getByRole("button", { name: "openDatabaseLayout" }));
    expect(screen.getByRole("button", { name: "closeDialog" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "closeDialog" }));
    expect(screen.queryByRole("button", { name: "closeDialog" })).toBeNull();
  });
});
