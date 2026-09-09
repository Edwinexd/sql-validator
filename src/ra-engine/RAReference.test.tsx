// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../i18n/context", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));

import RAReference from "./RAReference";

afterEach(() => cleanup());

describe("RAReference", () => {
  it("opens the reference containing unary, binary, notation, assignment, and condition help", () => {
    render(<RAReference />);
    fireEvent.click(screen.getByRole("button", { name: "raReference" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("raUnaryOps")).toBeTruthy();
    expect(screen.getByText("raBinaryOps")).toBeTruthy();
    expect(screen.getByText("raNotation")).toBeTruthy();
    expect(screen.getByText("raAssignment")).toBeTruthy();
    expect(screen.getByText("raConditions")).toBeTruthy();
    expect(screen.getByText("σ / sigma")).toBeTruthy();
    expect(screen.getByText("R ÷ S")).toBeTruthy();
  });
});
