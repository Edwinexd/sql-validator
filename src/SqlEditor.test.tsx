// @vitest-environment jsdom
import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const codeMirrorState = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));

vi.mock("@uiw/react-codemirror", async () => {
  const ReactModule = await import("react");
  return {
    default: ReactModule.forwardRef((props: Record<string, unknown>, _ref) => {
      codeMirrorState.props = props;
      return ReactModule.createElement("button", { "aria-label": "code-mirror", onClick: () => (props.onChange as (value: string) => void)("changed") }, String(props.value));
    }),
  };
});

import SqlEditor, { SqlEditorHandle } from "./SqlEditor";

afterEach(() => cleanup());

describe("SqlEditor", () => {
  it("configures an interactive PostgreSQL editor with autocomplete", () => {
    const onChange = vi.fn();
    const ref = createRef<SqlEditorHandle>();
    render(<SqlEditor ref={ref} id="query" value="select 1" onChange={onChange} engine="postgresql" schema={{ people: ["id"] }} editorSettings={{ autocomplete: true, lineNumbers: true, highlightActiveLine: true, tabSize: 4 }} />);
    fireEvent.click(screen.getByRole("button", { name: "code-mirror" }));
    expect(onChange).toHaveBeenCalledWith("changed");
    expect(codeMirrorState.props).toMatchObject({ id: "query", readOnly: false, editable: true, minHeight: "8rem", theme: "light" });
    expect(codeMirrorState.props!.basicSetup).toMatchObject({ lineNumbers: true, highlightActiveLine: true, autocompletion: true });
    expect((codeMirrorState.props!.extensions as unknown[])).toHaveLength(4);
    expect(() => ref.current!.clearHistory()).not.toThrow();
  });

  it("uses relational algebra and read-only settings when requested", () => {
    render(<SqlEditor value="π[id](people)" mode="ra" isDarkMode readOnly editorSettings={{ autocomplete: false, lineNumbers: true, highlightActiveLine: true, tabSize: 2 }} />);
    expect(codeMirrorState.props).toMatchObject({ readOnly: true, editable: false, minHeight: undefined, theme: "dark" });
    expect(codeMirrorState.props!.basicSetup).toMatchObject({ lineNumbers: false, highlightActiveLine: false, autocompletion: false });
    expect((codeMirrorState.props!.extensions as unknown[])).toHaveLength(4);
  });

  it("does not add PostgreSQL completions when they are disabled", () => {
    render(<SqlEditor value="SELECT 1" engine="postgresql" disabled editorSettings={{ autocomplete: false, lineNumbers: false, highlightActiveLine: false, tabSize: 8 }} />);
    expect(codeMirrorState.props).toMatchObject({ readOnly: true, editable: false });
    expect((codeMirrorState.props!.extensions as unknown[])).toHaveLength(3);
  });
});
