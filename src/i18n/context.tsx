import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE } from "./languages";
import { uiStrings } from "./ui-strings";

export interface QuestionCategory {
  category_id: number;
  display_number: number;
  questions: Array<{
    id: number;
    description: string;
    display_sequence: string;
    result: {
      columns: string[];
      values: (string | number | null)[][];
    };
    alternative_results?: Array<{
      columns: string[];
      values: (string | number | null)[][];
    }>;
  }>;
}

interface LanguageContextValue {
  /** Current language code */
  lang: string;
  /** Switch to a different language */
  setLang: (lang: string) => void;
  /** Translate a UI string key, with optional parameter interpolation */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** The question pool for the current language */
  questions: QuestionCategory[];
  /** The database ArrayBuffer for the current language */
  dbArrayBuffer: ArrayBuffer | null;
  /** Default query for the current language */
  defaultQuery: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): string {
  // 1. URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get("lang");
  if (urlLang && AVAILABLE_LANGUAGES.some(l => l.code === urlLang)) {
    return urlLang;
  }
  // 2. localStorage
  const stored = localStorage.getItem("language");
  if (stored && AVAILABLE_LANGUAGES.some(l => l.code === stored)) {
    return stored;
  }
  // 3. Default
  return DEFAULT_LANGUAGE;
}

function updateUrlParam(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value === null) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState({}, "", url.toString());
}

export function getUrlParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

export function setUrlParam(key: string, value: string | null) {
  updateUrlParam(key, value);
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState(getInitialLanguage);
  const [questions, setQuestions] = useState<QuestionCategory[]>([]);
  const [dbArrayBuffer, setDbArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [defaultQuery, setDefaultQuery] = useState("SELECT * FROM Student;");

  const loadLanguageData = useCallback(async (langCode: string) => {
    try {
      const [qpResponse, dbResponse] = await Promise.all([
        fetch(`/languages/${langCode}/questionpool.json`),
        fetch(`/languages/${langCode}/data.sqlite3`),
      ]);

      if (!qpResponse.ok || !dbResponse.ok) {
        console.error(`Failed to load language data for ${langCode}`);
        return;
      }

      const qpData = await qpResponse.json();
      setQuestions(qpData.questions);
      setDefaultQuery(qpData.defaultQuery || "SELECT * FROM Student;");

      const dbData = await dbResponse.arrayBuffer();
      setDbArrayBuffer(dbData);
    } catch (e) {
      console.error("Failed to load language data:", e);
    }
  }, []);

  useEffect(() => {
    loadLanguageData(lang);
    // Always reflect language in URL (even default)
    updateUrlParam("lang", lang);
  }, [lang, loadLanguageData]);

  const setLang = useCallback((newLang: string) => {
    if (!AVAILABLE_LANGUAGES.some(l => l.code === newLang)) return;
    localStorage.setItem("language", newLang);
    updateUrlParam("lang", newLang);
    setLangState(newLang);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const strings = uiStrings[lang] || uiStrings[DEFAULT_LANGUAGE] || {};
    let value = strings[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
      }
    }
    return value;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, questions, dbArrayBuffer, defaultQuery }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}

/**
 * Helper to get a localStorage key namespaced by language.
 */
export function langKey(lang: string, key: string): string {
  return `${lang}:${key}`;
}
