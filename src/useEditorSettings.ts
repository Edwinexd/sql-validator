import { useState, useCallback } from "react";

export interface EditorSettings {
  autocomplete: boolean;
  lineNumbers: boolean;
  highlightActiveLine: boolean;
  tabSize: number;
}

const STORAGE_KEY = "editorSettings";

const DEFAULTS: EditorSettings = {
  autocomplete: true,
  lineNumbers: false,
  highlightActiveLine: true,
  tabSize: 2,
};

function loadSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function useEditorSettings() {
  const [settings, setSettingsState] = useState<EditorSettings>(loadSettings);

  const setSettings = useCallback((partial: Partial<EditorSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, setSettings };
}
