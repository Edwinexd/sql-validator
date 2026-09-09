// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorSettings } from "./useEditorSettings";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("useEditorSettings", () => {
  it("uses defaults and persists partial changes", () => {
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current.settings).toEqual({
      autocomplete: true,
      lineNumbers: false,
      highlightActiveLine: true,
      tabSize: 2,
    });

    act(() => result.current.setSettings({ lineNumbers: true, tabSize: 4 }));

    expect(result.current.settings).toMatchObject({ lineNumbers: true, tabSize: 4 });
    expect(JSON.parse(localStorage.getItem("editorSettings")!)).toMatchObject({ lineNumbers: true, tabSize: 4 });
  });

  it("merges stored values and safely falls back from malformed storage", () => {
    localStorage.setItem("editorSettings", JSON.stringify({ tabSize: 8, autocomplete: false }));
    const first = renderHook(() => useEditorSettings());
    expect(first.result.current.settings).toMatchObject({ tabSize: 8, autocomplete: false, lineNumbers: false });
    first.unmount();

    localStorage.setItem("editorSettings", "not json");
    const second = renderHook(() => useEditorSettings());
    expect(second.result.current.settings.tabSize).toBe(2);
  });
});
