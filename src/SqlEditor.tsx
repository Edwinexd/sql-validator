import { useCallback, useImperativeHandle, useMemo, useRef, forwardRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { sql, PostgreSQL, SQLite } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { acceptCompletion } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import type { EngineType } from "./i18n/languages";
import type { EditorSettings } from "./useEditorSettings";
import { raStreamLanguage } from "./ra-engine/raLanguage";

export interface SqlEditorHandle {
  clearHistory(): void;
}

interface SqlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  schema?: Record<string, string[]>;
  engine?: EngineType;
  mode?: "sql" | "ra";
  isDarkMode?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  editorSettings?: EditorSettings;
}

const baseStyle = EditorView.theme({
  "&.cm-editor": {
    fontSize: "1rem",
    backgroundColor: "transparent",
  },
  ".cm-content": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    padding: "10px",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  "&.cm-editor.cm-focused": {
    outline: "none",
  },
});

const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(({
  value,
  onChange,
  schema,
  engine = "sqlite",
  mode = "sql",
  isDarkMode = false,
  readOnly = false,
  disabled = false,
  className = "",
  id,
  editorSettings,
}, ref) => {
  const cmRef = useRef<ReactCodeMirrorRef>(null);

  const autocomplete = engine === "postgresql" && (editorSettings?.autocomplete ?? true);
  const lineNumbers = editorSettings?.lineNumbers ?? false;
  const highlightActiveLine = editorSettings?.highlightActiveLine ?? true;
  const tabSize = editorSettings?.tabSize ?? 2;

  useImperativeHandle(ref, () => ({
    clearHistory() {
      // CodeMirror manages history per-state; question switching replaces value
      // which naturally resets the undo stack
    },
  }));

  const handleChange = useCallback((val: string) => {
    if (onChange) onChange(val);
  }, [onChange]);

  const extensions = useMemo((): Extension[] => {
    const exts: Extension[] = [baseStyle, EditorState.tabSize.of(tabSize)];

    if (mode === "ra") {
      exts.push(raStreamLanguage);
    } else {
      const dialect = engine === "postgresql" ? PostgreSQL : SQLite;
      exts.push(sql({
        dialect,
        schema: autocomplete ? schema : undefined,
        upperCaseKeywords: true,
      }));
      if (autocomplete) {
        exts.push(keymap.of([{ key: "Tab", run: acceptCompletion }]));
      }
    }

    if (isDarkMode) {
      exts.push(oneDark);
    }

    return exts;
  }, [engine, mode, schema, isDarkMode, autocomplete, tabSize]);

  const isInteractive = !readOnly && !disabled;

  return (
    <CodeMirror
      ref={cmRef}
      id={id}
      value={value}
      height="auto"
      minHeight={isInteractive ? "8rem" : undefined}
      onChange={handleChange}
      theme={isDarkMode ? "dark" : "light"}
      extensions={extensions}
      readOnly={!isInteractive}
      editable={isInteractive}
      basicSetup={{
        lineNumbers: lineNumbers && isInteractive,
        foldGutter: false,
        highlightActiveLine: highlightActiveLine && isInteractive,
        autocompletion: autocomplete && mode === "sql" && isInteractive,
      }}
      className={`text-left ${className}`}
    />
  );
});

SqlEditor.displayName = "SqlEditor";
export default SqlEditor;
