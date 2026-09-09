// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useTheme from "./useTheme";

let prefersDark = false;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.head.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.remove());
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: prefersDark })),
  });
});

afterEach(() => cleanup());

describe("useTheme", () => {
  it("uses the system preference when no override is stored", () => {
    prefersDark = true;
    const { result } = renderHook(() => useTheme());

    expect(result.current.getTheme()).toBe("dark");
    expect(result.current.isDarkMode()).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#1f2937");
  });

  it("persists explicit changes, supports system mode, and toggles", () => {
    prefersDark = false;
    localStorage.theme = "dark";
    const { result } = renderHook(() => useTheme());

    expect(result.current.getTheme()).toBe("dark");
    act(() => result.current.setTheme("light"));
    expect(localStorage.theme).toBe("light");
    expect(result.current.isDarkMode()).toBe(false);
    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#f3f4f6");

    act(() => result.current.setTheme("system"));
    expect("theme" in localStorage).toBe(false);
    act(() => result.current.toggleTheme());
    expect(result.current.getTheme()).toBe("light");
  });
});
