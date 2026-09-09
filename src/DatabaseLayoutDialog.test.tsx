// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DatabaseLayoutDialog from "./DatabaseLayoutDialog";

vi.mock("./i18n/context", () => ({
  useLanguage: () => ({
    lang: "en",
    engine: "sqlite",
    t: (key: string) => key,
  }),
}));

describe("DatabaseLayoutDialog", () => {
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
});
