import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE, type EngineType } from "./languages";
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

/** Database data: ArrayBuffer for SQLite, string (SQL dump) for PostgreSQL */
export type DbData = ArrayBuffer | string;

interface LanguageContextValue {
  /** Current language code */
  lang: string;
  /** Switch to a different language */
  setLang: (lang: string) => void;
  /** Translate a UI string key, with optional parameter interpolation */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** The question pool for the current language */
  questions: QuestionCategory[];
  /** The database data for the current language + engine */
  dbData: DbData | null;
  /** Default query for the current language */
  defaultQuery: string;
  /** Current database engine */
  engine: EngineType;
  /** Switch engine */
  setEngine: (engine: EngineType) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const DEFAULT_ENGINE: EngineType = "sqlite";

function getInitialLanguage(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get("lang");
  if (urlLang && AVAILABLE_LANGUAGES.some(l => l.code === urlLang)) {
    return urlLang;
  }
  const stored = localStorage.getItem("language");
  if (stored && AVAILABLE_LANGUAGES.some(l => l.code === stored)) {
    return stored;
  }
  return DEFAULT_LANGUAGE;
}

function getInitialEngine(): EngineType {
  const urlParams = new URLSearchParams(window.location.search);
  const urlEngine = urlParams.get("engine");
  if (urlEngine === "postgresql" || urlEngine === "sqlite") {
    return urlEngine;
  }
  const stored = localStorage.getItem("engine");
  if (stored === "postgresql" || stored === "sqlite") {
    return stored;
  }
  return DEFAULT_ENGINE;
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

/**
 * Returns the data directory path for a language + engine combination.
 * SQLite data lives under /languages/{code}/
 * PostgreSQL data lives under /languages/{code}-pg/
 */
function dataPath(langCode: string, engine: EngineType): string {
  return engine === "postgresql" ? `/languages/${langCode}-pg` : `/languages/${langCode}`;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState(getInitialLanguage);
  const [engine, setEngineState] = useState<EngineType>(getInitialEngine);
  const [questions, setQuestions] = useState<QuestionCategory[]>([]);
  const [dbData, setDbData] = useState<DbData | null>(null);
  const [defaultQuery, setDefaultQuery] = useState("SELECT * FROM Student;");

  const loadLanguageData = useCallback(async (langCode: string, engineType: EngineType) => {
    const base = dataPath(langCode, engineType);
    const dataFile = engineType === "postgresql" ? "data.sql" : "data.sqlite3";

    try {
      const [qpResponse, dbResponse] = await Promise.all([
        fetch(`${base}/questionpool.json`),
        fetch(`${base}/${dataFile}`),
      ]);

      if (!qpResponse.ok || !dbResponse.ok) {
        console.error(`Failed to load language data for ${langCode} (${engineType})`);
        return;
      }

      const qpData = await qpResponse.json();
      setQuestions(qpData.questions);
      setDefaultQuery(qpData.defaultQuery || "SELECT * FROM Student;");

      if (engineType === "postgresql") {
        const sqlText = await dbResponse.text();
        setDbData(sqlText);
      } else {
        const arrayBuf = await dbResponse.arrayBuffer();
        setDbData(arrayBuf);
      }
    } catch (e) {
      console.error("Failed to load language data:", e);
    }
  }, []);

  useEffect(() => {
    loadLanguageData(lang, engine);
    updateUrlParam("lang", lang);
    updateUrlParam("engine", engine === DEFAULT_ENGINE ? null : engine);
  }, [lang, engine, loadLanguageData]);

  const setLang = useCallback((newLang: string) => {
    if (!AVAILABLE_LANGUAGES.some(l => l.code === newLang)) return;
    localStorage.setItem("language", newLang);
    updateUrlParam("lang", newLang);
    setLangState(newLang);
  }, []);

  const setEngine = useCallback((newEngine: EngineType) => {
    localStorage.setItem("engine", newEngine);
    updateUrlParam("engine", newEngine === DEFAULT_ENGINE ? null : newEngine);
    setEngineState(newEngine);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const baseLang = lang.replace(/-pg$/, "");
    const strings = uiStrings[lang] || uiStrings[baseLang] || uiStrings[DEFAULT_LANGUAGE] || {};
    let value = strings[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
      }
    }
    return value;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, questions, dbData, defaultQuery, engine, setEngine }}>
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
