/*
Fully client/web side SQL validation for the database course at Stockholm University
Copyright (C) 2024 Edwin Sundberg

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import ResultTable from "./ResultTable";

import ExportRenderer from "./ExportRenderer";
import QuestionSelector, { Question } from "./QuestionSelector";

import { format } from "sql-formatter";
import initSqlJs from "sql.js";
import ViewsTable, { View } from "./ViewsTable";
import { raToSQL, RAError } from "./ra-engine/relationalAlgebra";
import RAReference from "./ra-engine/RAReference";
import RAPreview from "./ra-engine/RAPreview";
import SqlEditor, { type SqlEditorHandle } from "./SqlEditor";

import { Info, Settings, XCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import sha256 from "crypto-js/sha256";
import { format as formatFns } from "date-fns";
import { toPng } from "html-to-image";
import PrivacyNoticeToggle from "./PrivacyNoticeToggle";
import LicenseDialog from "./LicenseDialog";
import ThemeToggle from "./ThemeToggle";
import useTheme from "./useTheme";
import { isCorrectResult, Result } from "./utils";
import DatabaseLayoutDialog from "./DatabaseLayoutDialog";
import ExportSelectorModal, { ExportSelectorModalHandle } from "./ExportSelectorModal";
import ImportDialog, { ImportDialogHandle } from "./ImportDialog";
import { ParsedSaveData, parseImportFile, getLocalData, detectConflicts } from "./mergeUtils";
import { useLanguage, langKey, getUrlParam, setUrlParam } from "./i18n/context";
import LanguageSelector from "./LanguageSelector";
import EngineSelector from "./EngineSelector";
import { getQuestion } from "./QuestionSelector";

import type { DatabaseEngine } from "./database/types";
import { SqliteEngine } from "./database/sqliteEngine";
import { PgliteEngine } from "./database/pgliteEngine";
import { useEditorSettings } from "./useEditorSettings";
import EditorSettingsDialog from "./EditorSettingsDialog";

/** Storage key namespaced by editor mode */
function modeKey(base: string, mode: "sql" | "ra"): string {
  return mode === "ra" ? `ra-${base}` : base;
}

/** Build a localStorage key namespaced by language and engine */
function engineKey(lang: string, engine: string, key: string): string {
  return langKey(lang, `${engine}:${key}`);
}

/** Get a JSON-parsed list from localStorage, with language+engine+mode namespacing */
function getStoredList(lang: string, engine: string, key: string): number[] {
  const raw = localStorage.getItem(engineKey(lang, engine, key));
  return raw ? JSON.parse(raw) : [];
}

/** Set a JSON list in localStorage, with language+engine namespacing */
function setStoredList(lang: string, engine: string, key: string, value: number[]): void {
  localStorage.setItem(engineKey(lang, engine, key), JSON.stringify(value));
}

function App() {
  const { lang, t, questions, dbData, defaultQuery, engine } = useLanguage();
  const { settings: editorSettings, setSettings: setEditorSettings } = useEditorSettings();
  const [question, setQuestion] = useState<Question>();
  const [database, setDatabase] = useState<DatabaseEngine>();
  const [dbSchema, setDbSchema] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  // flag for correct result query being present but current (which might not be evaluated) is not the same
  const [correctQueryMismatch, setCorrectQueryMismatch] = useState<boolean>(false);
  const [query, setQuery] = useState<string | undefined>();
  const [result, setResult] = useState<Result>();
  const [evaluatedQuery, setEvaluatedQuery] = useState<string | null>(null);
  const [showViewsTable, setDisplayViewsTable] = useState<boolean>(false);
  const [isViewResult, setIsViewResult] = useState<boolean>(false);
  const [queryedView, setQueryedView] = useState<string | null>(null);
  const [views, setViews] = useState<View[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean>();
  const [matchedResult, setMatchedResult] = useState<Result>();
  const { getTheme, setTheme, isDarkMode } = useTheme();
  // Exporting functionality / flags
  const [exportView, setExportView] = useState<View>();
  const [exportQuestion, setExportQuestion] = useState<Question>();
  const [exportQuery, setExportQuery] = useState<string | undefined>();
  const [exportingStatus, setExportingStatus] = useState<number>(0);
  const [loadedQuestionCorrect, setLoadedQuestionCorrect] = useState<boolean>(false);
  const [editorMode, setEditorMode] = useState<"sql" | "ra">(() => {
    const param = getUrlParam("mode");
    return param === "ra" ? "ra" : "sql";
  });

  const exportRendererRef = useRef<HTMLDivElement>(null);

  const sqlEditorRef = useRef<SqlEditorHandle>(null);
  const exportModalRef = useRef<ExportSelectorModalHandle>(null);
  const importDialogRef = useRef<ImportDialogHandle>(null);
  const [pendingImportData, setPendingImportData] = useState<ParsedSaveData | null>(null);

  // QuestionSelector needs writtenQuestions and correctQuestions to be able to display the correct state
  const [writtenQuestions, setWrittenQuestions] = useState<number[]>(() =>
    getStoredList(lang, engine, modeKey("writtenQuestions", editorMode))
  );
  const [correctQuestions, setCorrectQuestions] = useState<number[]>(() =>
    getStoredList(lang, engine, modeKey("correctQuestions", editorMode))
  );

  /** sql-formatter language based on engine */
  const formatterLang = engine === "postgresql" ? "postgresql" : "sqlite";

  // One-time migration: copy old unnamespaced keys to sv: prefix
  useEffect(() => {
    if (localStorage.getItem("i18n-migrated")) return;
    const oldWritten = localStorage.getItem("writtenQuestions");
    if (oldWritten && !localStorage.getItem(langKey("sv", "writtenQuestions"))) {
      localStorage.setItem(langKey("sv", "writtenQuestions"), oldWritten);
      const ids: number[] = JSON.parse(oldWritten);
      for (const id of ids) {
        const q = localStorage.getItem(`questionId-${id}`);
        if (q) localStorage.setItem(langKey("sv", `questionId-${id}`), q);
      }
    }
    const oldCorrect = localStorage.getItem("correctQuestions");
    if (oldCorrect && !localStorage.getItem(langKey("sv", "correctQuestions"))) {
      localStorage.setItem(langKey("sv", "correctQuestions"), oldCorrect);
      const ids: number[] = JSON.parse(oldCorrect);
      for (const id of ids) {
        const q = localStorage.getItem(`correctQuestionId-${id}`);
        if (q) localStorage.setItem(langKey("sv", `correctQuestionId-${id}`), q);
      }
    }
    const oldViews = localStorage.getItem("views");
    if (oldViews && !localStorage.getItem(langKey("sv", "views"))) {
      localStorage.setItem(langKey("sv", "views"), oldViews);
    }
    localStorage.setItem("i18n-migrated", "1");
  }, []);

  // Reload written/correct questions when language or mode changes
  useEffect(() => {
    setWrittenQuestions(getStoredList(lang, engine, modeKey("writtenQuestions", editorMode)));
    setCorrectQuestions(getStoredList(lang, engine, modeKey("correctQuestions", editorMode)));
  }, [lang, editorMode]);

  const resetResult = useCallback(() => {
    setResult(undefined);
    setIsCorrect(undefined);
    setMatchedResult(undefined);
    setEvaluatedQuery(null);
    setIsViewResult(false);
    setQueryedView(null);
  }, []);

  const switchEditorMode = useCallback((mode: "sql" | "ra") => {
    // Save current query before switching
    if (question && query !== undefined) {
      const currentKey = modeKey(`questionId-${question.id}`, editorMode);
      if (query === defaultQuery || query === "") {
        localStorage.removeItem(engineKey(lang, engine, currentKey));
      } else {
        localStorage.setItem(engineKey(lang, engine, currentKey), query);
      }
    }
    setEditorMode(mode);

    setError(null);
    resetResult();
    // Load query for the new mode
    if (question) {
      const newKey = modeKey(`questionId-${question.id}`, mode);
      setQuery(localStorage.getItem(engineKey(lang, engine, newKey)) || (mode === "ra" ? "" : defaultQuery));
    }
    // Reload progress for the new mode
    setWrittenQuestions(getStoredList(lang, engine, modeKey("writtenQuestions", mode)));
    setCorrectQuestions(getStoredList(lang, engine, modeKey("correctQuestions", mode)));
  }, [resetResult, question, query, editorMode, lang, defaultQuery]);

  const initDb = useCallback(async () => {
    if (!dbData) return;
    resetResult();

    let db: DatabaseEngine;
    if (engine === "postgresql") {
      const { PGlite } = await import("@electric-sql/pglite");
      const pg = new PGlite();
      await pg.exec(dbData as string);
      db = new PgliteEngine(pg);
    } else {
      const SQL = await initSqlJs({
        locateFile: (file) => `/dist/sql.js/${file}`,
      });
      const sqliteDb = new SQL.Database(new Uint8Array(dbData as ArrayBuffer));
      sqliteDb.create_function("YEAR", (date: string) => new Date(date).getFullYear());
      sqliteDb.create_function("MONTH", (date: string) => new Date(date).getMonth() + 1);
      sqliteDb.create_function("DAY", (date: string) => new Date(date).getDate());
      sqliteDb.exec("PRAGMA foreign_keys = ON;");
      db = new SqliteEngine(sqliteDb);
    }

    // Extract schema for autocomplete
    const schema = await db.getSchema();
    setDbSchema(schema);
    setDatabase(db);
  }, [resetResult, dbData, engine]);

  useEffect(() => {
    initDb();
  }, [initDb]);

  // Reset state when language changes (skip initial mount)
  const prevLangRef = useRef(lang);
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;
    setQuestion(undefined);
    setQuery(undefined);
    setViews([]);
    setDisplayViewsTable(false);
    resetResult();
    setUrlParam("q", null);
  }, [lang, resetResult]);

  // On engine change, keep the question but reload query and reset results
  const prevEngineRef = useRef(engine);
  useEffect(() => {
    if (prevEngineRef.current === engine) return;
    prevEngineRef.current = engine;
    // Reload the query for this question under the new engine context
    if (question) {
      const key = modeKey(`questionId-${question.id}`, editorMode);
      setQuery(localStorage.getItem(engineKey(lang, engine, key)) || (editorMode === "ra" ? "" : defaultQuery));
    }
    setViews([]);
    setDisplayViewsTable(false);
    resetResult();
  }, [engine, question, editorMode, lang, defaultQuery, resetResult]);

  // Restore question from URL param when questions become available
  const urlRestoredRef = useRef(false);
  useEffect(() => {
    if (questions.length === 0 || urlRestoredRef.current) return;
    urlRestoredRef.current = true;
    const qParam = getUrlParam("q");
    if (!qParam) return;
    const match = qParam.match(/^(\d+)([A-Z]+)$/i);
    if (match) {
      const cat = questions.find(c => c.display_number === Number(match[1]));
      const q = cat?.questions.find(q => q.display_sequence.toUpperCase() === match[2].toUpperCase());
      if (q) {
        const resolved = getQuestion(q.id, questions);
        if (resolved) {
          setQuestion(resolved);
          setQuery(localStorage.getItem(engineKey(lang, engine, modeKey(`questionId-${resolved.id}`, editorMode))) || (editorMode === "ra" ? "" : defaultQuery));
        }
      }
    }
  }, [questions, lang, defaultQuery]);

  // Sync selected question to URL
  useEffect(() => {
    if (question) {
      setUrlParam("q", `${question.category.display_number}${question.display_sequence}`);
    } else if (urlRestoredRef.current) {
      setUrlParam("q", null);
    }
  }, [question]);

  // Sync editor mode to URL
  useEffect(() => {
    setUrlParam("mode", editorMode === "ra" ? "ra" : null);
  }, [editorMode]);

  // Track which language the current question was loaded in
  const questionLangRef = useRef(lang);
  useEffect(() => {
    if (question) questionLangRef.current = lang;
  }, [question, lang]);

  // Validate query on change
  useEffect(() => {
    if (!database || !question || query === undefined) {
      return;
    }
    if (questionLangRef.current !== lang) {
      return;
    }
    const wqStorageKey = modeKey("writtenQuestions", editorMode);
    let wq = getStoredList(lang, engine, wqStorageKey);
    const initialLength = wq.length;
    const storageKey = modeKey(`questionId-${question.id}`, editorMode);
    if (query === defaultQuery || query === "") {
      localStorage.removeItem(engineKey(lang, engine, storageKey));
      wq = wq.filter((id: number) => id !== question.id);
    } else {
      localStorage.setItem(engineKey(lang, engine, storageKey), query);
      if (!wq.includes(question.id)) {
        wq.push(question.id);
      }
    }
    if (wq.length !== initialLength) {
      setStoredList(lang, engine, wqStorageKey, wq);
      setWrittenQuestions(wq);
    }

    // Stale check for async validation
    let stale = false;
    const validate = async () => {
      if (editorMode === "sql") {
        const errorMsg = await database.validateStatements(query);
        if (stale) return;
        if (errorMsg === "multiple_statements") {
          setError(t("multipleStatements"));
        } else if (errorMsg) {
          setError(errorMsg);
        } else {
          setError(null);
        }
      } else {
        // In RA mode, try to parse and validate against database
        try {
          await raToSQL(query, database);
          if (stale) return;
          setError(null);
        } catch (e) {
          if (stale) return;
          if (e instanceof RAError) {
            setError(t("raParseError", { message: e.message }));
          } else {
            setError((e as Error).message);
          }
        }
      }
    };
    validate();
    return () => { stale = true; };
  }, [database, query, question, lang, defaultQuery, t, editorMode]);


  const refreshViews = useCallback(async (upsert: boolean) => {
    if (!database) {
      return;
    }

    const fetchedViews = await database.getViews();

    if (fetchedViews.length - views.length !== 0) {
      setDisplayViewsTable(true);
    }

    if (upsert) {
      localStorage.setItem(engineKey(lang, engine, "views"), JSON.stringify(fetchedViews));
    }

    setViews(fetchedViews);

    // Recreate missing views from localStorage
    const storedViews = localStorage.getItem(engineKey(lang, engine, "views"));
    if (storedViews) {
      const savedViews: View[] = JSON.parse(storedViews);
      const missingViews = savedViews.filter(
        savedView => !fetchedViews.some(fetchedView => fetchedView.name === savedView.name)
      );
      let recreated = 0;
      for (const view of missingViews) {
        try {
          await database.exec(view.query);
          recreated++;
        } catch (e) {
          console.warn(`Failed to recreate view "${view.name}":`, (e as Error).message);
        }
      }
      if (recreated > 0) {
        refreshViews(false);
      }
    }
  }, [database, views.length, lang]);

  const runQuery = useCallback(async () => {
    if (!database || query === undefined) {
      return;
    }
    try {
      let sqlToRun = query;
      if (editorMode === "ra") {
        try {
          sqlToRun = await raToSQL(query, database);
        } catch (e) {
          if (e instanceof RAError) {
            setError(t("raParseError", { message: e.message }));
          } else {
            setError((e as Error).message);
          }
          return;
        }
      }
      const res = await database.exec(sqlToRun);
      setIsViewResult(false);
      setQueryedView(null);
      setEvaluatedQuery(query);
      if (res.length !== 0) {
        const { columns, values } = res[0];
        setResult({ columns, data: values as (string | number | Uint8Array | null)[][] });
      } else {
        setResult({columns: [], data: []});
      }
      await refreshViews(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [database, query, refreshViews, editorMode, t]);

  const evalSql = useCallback(async (sql: string): Promise<Result> => {
    if (!database) {
      return { columns: [], data: [] };
    }
    try {
      const res = await database.exec(sql);
      if (res.length !== 0) {
        const { columns, values } = res[0];
        return { columns, data: values as (string | number | Uint8Array | null)[][] };
      }
      return { columns: [], data: [] };
    } catch (e) {
      alert("Error occurred while evaluating SQL Query internally: " + (e as Error).message);
      return { columns: [], data: [] };
    }
  }, [database]);

  const getViewResult = useCallback(async (name: string) => {
    if (!database) {
      return;
    }
    try {
      const viewQuery = `SELECT * FROM ${name}`;
      const res = await database.exec(viewQuery);
      setIsViewResult(true);
      setQueryedView(name);
      setEvaluatedQuery(viewQuery);
      if (res.length !== 0) {
        const { columns, values } = res[0];
        setResult({ columns, data: values as (string | number | Uint8Array | null)[][] });
      } else {
        setResult({columns: [], data: []});
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [database]);

  const deleteView = useCallback(async (name: string) => {
    if (!database) {
      return;
    }

    if (!window.confirm(t("confirmDeleteView", { name }))) {
      return;
    }

    await database.exec(`DROP VIEW ${name}`);
    await refreshViews(true);

    if (isViewResult && queryedView === name) {
      resetResult();
    }
  }, [database, isViewResult, queryedView, refreshViews, resetResult, t]);

  useEffect(() => {
    refreshViews(false);
  }, [database, refreshViews]);


  useEffect(() => {
    if (!result || !question || evaluatedQuery !== query) {
      return;
    }
    if (questionLangRef.current !== lang) {
      return;
    }
    const matchesPrimary = isCorrectResult(question.evaluable_result, result);
    const matchedAlt = !matchesPrimary ? question.alternative_evaluable_results?.find(alt => isCorrectResult(alt, result)) : undefined;
    if (!matchesPrimary && !matchedAlt) {
      setIsCorrect(false);
      setMatchedResult(undefined);
      return;
    }
    setIsCorrect(true);
    setMatchedResult(matchedAlt ?? question.evaluable_result);

    const cKey = modeKey(`correctQuestionId-${question.id}`, editorMode);
    localStorage.setItem(engineKey(lang, engine, cKey), query);
    setCorrectQueryMismatch(false);
    setLoadedQuestionCorrect(true);

    const cqStorageKey = modeKey("correctQuestions", editorMode);
    const cq = getStoredList(lang, engine, cqStorageKey);
    if (!cq.includes(question.id)) {
      cq.push(question.id);
      setStoredList(lang, engine, cqStorageKey, cq);
      setCorrectQuestions(cq);
    }
  }, [result, question, query, evaluatedQuery, exportingStatus, lang, editorMode]);

  // Save query based on question
  const loadQuery = useCallback((_oldQuestion: Question | undefined, newQuestion: Question) => {
    const key = modeKey(`questionId-${newQuestion.id}`, editorMode);
    setQuery(localStorage.getItem(engineKey(lang, engine, key)) || (editorMode === "ra" ? "" : defaultQuery));
    if (sqlEditorRef.current) {
      sqlEditorRef.current.clearHistory();
    }
  }, [setQuery, lang, defaultQuery, editorMode]);

  // Update mismatch & loadedQuestionCorrect flags when query is changed
  useEffect(() => {
    if (!database || !question || query === undefined) {
      return;
    }

    const cKey = modeKey(`correctQuestionId-${question.id}`, editorMode);
    const correctQuery = localStorage.getItem(engineKey(lang, engine, cKey));
    if (!correctQuery) {
      setCorrectQueryMismatch(false);
      setLoadedQuestionCorrect(false);
      return;
    }

    setLoadedQuestionCorrect(true);

    if (editorMode === "ra") {
      setCorrectQueryMismatch(query.trim() !== correctQuery.trim());
    } else {
      let currentQuery = "";
      try {
        currentQuery = format(query + (query.endsWith(";") ? "" : ";"), {
          language: formatterLang,
          tabWidth: 2,
          useTabs: false,
          keywordCase: "upper",
          dataTypeCase: "upper",
          functionCase: "upper",
        });
      } catch {
        setCorrectQueryMismatch(true);
        return;
      }
      const correctQueryFormatted = format(correctQuery + (correctQuery?.endsWith(";") ? "" : ";"), {
        language: formatterLang,
        tabWidth: 2,
        useTabs: false,
        keywordCase: "upper",
        dataTypeCase: "upper",
        functionCase: "upper",
      });
      setCorrectQueryMismatch(currentQuery !== correctQueryFormatted);
    }
  }, [database, question, query, lang, editorMode, formatterLang]);

  const exportData = useCallback((options?: { include?: number[]}) => {
    if (!database) {
      return;
    }
    let output = "";
    output += "/* --- BEGIN Comments --- */\n";
    output += `-- This file was generated by SQL Validator at ${new Date().toISOString()}\n`;
    output += "-- Do not edit this file manually as it may lead to data corruption!\n";
    output += "-- If you wish to edit anything for your submission, do so in the application and export again.\n";
    output += `-- Language: ${lang}\n`;
    output += "/* --- END Comments --- */\n";

    output += "/* --- BEGIN DO NOT EDIT --- */\n";

    output += "/* --- BEGIN Metadata --- */\n";
    output += "/* --- BEGIN Save Format Version --- */\n";
    output += "-- 4\n";
    output += "/* --- END Save Format Version --- */\n";
    output += "/* --- BEGIN Save Language --- */\n";
    output += `-- ${lang}\n`;
    output += "/* --- END Save Language --- */\n";
    output += "/* --- BEGIN Save Engine --- */\n";
    output += `-- ${engine}\n`;
    output += "/* --- END Save Engine --- */\n";
    output += "/* --- END Metadata --- */\n";

    output += "/* --- BEGIN Validation --- */\n";

    const storedCorrectIds = getStoredList(lang, engine, "correctQuestions");
    const storedWrittenIds = getStoredList(lang, engine, "writtenQuestions");

    const formatQuestionIds = (ids: number[]) => ids.map((id) => {
      const category = questions.find(c => c.questions.some(q => q.id === id))!;
      const q = category.questions.find(q => q.id === id)!;
      return { formatted: `${category.display_number}${q.display_sequence}`, number: category.display_number, sequence: q.display_sequence };
    }).sort((a, b) => a.sequence.localeCompare(b.sequence)).sort((a, b) => a.number - b.number).map(q => q.formatted).join(", ");

    const filterIds = (ids: number[]) => ids.filter((id) => options === undefined || (options.include && options.include.includes(id)));

    output += "/* --- BEGIN Submission Summary --- */\n";
    output += `-- Written Questions: ${formatQuestionIds(filterIds(storedCorrectIds))}\n`;
    output += "/* --- END Submission Summary --- */\n";
    if (views.length > 0) {
      output += "/* --- BEGIN Views --- */\n";
      const viewsString = views.map(view => {
        let out = format(view.query, {
          language: formatterLang,
          tabWidth: 2,
          useTabs: false,
          keywordCase: "upper",
          dataTypeCase: "upper",
          functionCase: "upper",
        });
        out += (view.query.endsWith(";") ? "" : ";");
        out = `/* --- BEGIN View ${view.name} --- */\n${out}\n/* --- END View ${view.name} --- */`;
        return out;
      }).join("\n");
      output += viewsString + "\n";
      output += "/* --- END Views --- */\n";
    }
    output += "/* --- BEGIN Submission Queries --- */\n";

    if (storedCorrectIds.length > 0) {
      const sorted = filterIds(storedCorrectIds).map((id) => {
        const category = questions.find(c => c.questions.some(q => q.id === id))!;
        const q = category.questions.find(q => q.id === id)!;
        return { category, question: q };
      }).map(({ category, question: q }) => { return { number: category.display_number, sequence: q.display_sequence, id: q.id };})
        .sort((a, b) => a.sequence.localeCompare(b.sequence)).sort((a, b) => a.number - b.number).map(q => q.id);
      const questionQueries = sorted.map((id: number) => {
        const category = questions.find(c => c.questions.some(q => q.id === id))!;
        const q = category.questions.find(q => q.id === id)!;
        const activeQuery = localStorage.getItem(engineKey(lang, engine, "correctQuestionId-" + id));
        if (!activeQuery) {
          return "";
        }
        let formatted = `/* --- BEGIN Question ${category.display_number}${q.display_sequence} (REFERENCE: ${q.id}) --- */\n`;
        formatted += format(activeQuery + (activeQuery.endsWith(";") ? "" : ";"), {
          language: formatterLang,
          tabWidth: 2,
          useTabs: false,
          keywordCase: "upper",
          dataTypeCase: "upper",
          functionCase: "upper",
        });
        formatted += `\n/* --- END Question ${category.display_number}${q.display_sequence} (REFERENCE: ${q.id}) --- */`;
        return formatted;
      }).join("\n");
      output += questionQueries;
      output += "\n";
    }
    output += "/* --- END Submission Queries --- */\n";

    output += "/* --- BEGIN Save Summary --- */\n";
    output += `-- Written Questions: ${formatQuestionIds(storedWrittenIds)}\n`;
    output += "/* --- END Save Summary --- */\n";
    const collectQueries = (ids: number[], keyPrefix: string) => {
      const queries: { [key: number]: string } = {};
      for (const id of ids) {
        const q = localStorage.getItem(engineKey(lang, engine, keyPrefix + id));
        if (q) queries[id] = q;
      }
      return queries;
    };

    output += "/* --- BEGIN Raw Queries --- */\n";
    output += "/*\n";
    output += JSON.stringify(collectQueries(storedWrittenIds, "questionId-"), null, 0).replace(/\*\//g, "\\*/");
    output += "\n*/\n";
    output += "/* --- END Raw Queries --- */\n";
    output += "/* --- BEGIN Correct Raw Queries --- */\n";
    output += "/*\n";
    output += JSON.stringify(collectQueries(storedCorrectIds, "correctQuestionId-"), null, 0).replace(/\*\//g, "\\*/");
    output += "\n*/\n";
    output += "/* --- END Correct Raw Queries --- */\n";
    output += "/* --- BEGIN Raw List Dumps --- */\n";
    output += "-- " + JSON.stringify(storedWrittenIds) + "\n";
    output += "-- " + JSON.stringify(filterIds(storedCorrectIds)) + "\n";
    output += "/* --- END Raw List Dumps --- */\n";

    output += "/* --- END Validation --- */\n";
    const hashValue = sha256(output.slice(output.indexOf("/* --- BEGIN Validation Block --- */"), output.indexOf("/* --- END Validation Block --- */")));
    output += `/* --- BEGIN Hash --- */\n-- ${hashValue}\n/* --- END Hash --- */\n`;
    output += "/* --- END DO NOT EDIT --- */\n";

    const blob = new Blob([output], { type: "text/sql" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const formattedTimestamp = formatFns(new Date(), "yyyyMMdd_HHmm");
    a.href = url;
    a.download = `validator_${lang}_${engine}_${formattedTimestamp}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }, [database, views, lang, questions, formatterLang]);

  const applyMergedData = useCallback(async (merged: ParsedSaveData) => {
    // Clear current data
    getStoredList(lang, engine, "writtenQuestions").forEach(id => localStorage.removeItem(engineKey(lang, engine, `questionId-${id}`)));
    getStoredList(lang, engine, "correctQuestions").forEach(id => localStorage.removeItem(engineKey(lang, engine, `correctQuestionId-${id}`)));
    localStorage.removeItem(engineKey(lang, engine, "writtenQuestions"));
    localStorage.removeItem(engineKey(lang, engine, "correctQuestions"));

    // Write merged data
    for (const [key, value] of Object.entries(merged.rawQueries)) {
      localStorage.setItem(engineKey(lang, engine, `questionId-${key}`), value);
      if (question !== undefined && Number(key) === question.id) {
        setQuery(value);
      }
    }
    for (const [key, value] of Object.entries(merged.correctQueries)) {
      localStorage.setItem(engineKey(lang, engine, `correctQuestionId-${key}`), value);
    }

    setWrittenQuestions(merged.writtenQuestionIds);
    setCorrectQuestions(merged.correctQuestionIds);
    setStoredList(lang, engine, "writtenQuestions", merged.writtenQuestionIds);
    setStoredList(lang, engine, "correctQuestions", merged.correctQuestionIds);

    // Update views in database
    if (database) {
      for (const view of views) {
        await database.exec(`DROP VIEW ${view.name}`);
      }
      for (const view of merged.views) {
        await database.exec(view.query);
      }
      await refreshViews(true);
    }
  }, [database, question, refreshViews, views, lang]);

  const importData = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".sql";
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) {
        return;
      }
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!e.target || typeof e.target.result !== "string") {
          return;
        }
        const data = e.target.result;
        if (!data) {
          return;
        }
        const parsed = parseImportFile(data);
        setPendingImportData(parsed);
        const local = getLocalData(lang, engine);
        const analysis = detectConflicts(local, parsed);
        importDialogRef.current?.open(analysis);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [lang]);

  // Overriding default behavior for ctrl+s to call exportData instead
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        exportData();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [exportData]);


  // Png exports
  const exportImageQuery = useCallback(() => {
    if (question === undefined || !loadedQuestionCorrect || exportView) {
      return;
    }

    const toExportQuery = localStorage.getItem(engineKey(lang, engine, modeKey(`correctQuestionId-${question.id}`, editorMode)));
    if (!toExportQuery) {
      return;
    }

    setExportQuery(toExportQuery);
    setExportQuestion(question);
  }, [exportView, loadedQuestionCorrect, question, lang, editorMode]);

  const exportImageView = useCallback((name: string) => {
    if (!database || exportQuery) {
      return;
    }
    const view = views.find(v => v.name === name);
    if (!view) {
      return;
    }
    setExportView(view);
  }, [database, exportQuery, views]);

  useEffect(() => {
    if (!exportRendererRef.current || exportingStatus >= 1) {
      return;
    }

    setExportingStatus(1);

    // Wait for CodeMirror to render before capturing
    const capture = () => { requestAnimationFrame(() => {
      if (!exportRendererRef.current) { setExportingStatus(0); return; }

      const triggerDownload = (dataUrl: string, filename: string) => {
        const byteString = atob(dataUrl.split(",")[1]);
        const mimeType = dataUrl.split(",")[0].split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.download = filename;
        link.href = blobUrl;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 100);
      };

      // View
      if (exportView) {
        toPng(exportRendererRef.current, {
          canvasWidth: exportRendererRef.current.clientWidth,
          width: exportRendererRef.current.clientWidth,
          canvasHeight: exportRendererRef.current.clientHeight,
          height: exportRendererRef.current.clientHeight,
          pixelRatio: 1
        }).then((dataUrl) => {
          triggerDownload(dataUrl, `validator_${exportView.name}.png`);
          setExportView(undefined);
          setExportingStatus(0);
        });
        return;
      }

      // Question
      if (!question || !exportQuery || !exportQuestion) {
        return;
      }

      const exportRenderer = exportRendererRef.current;
      toPng(exportRenderer, {
        canvasWidth: exportRenderer.clientWidth,
        width: exportRenderer.clientWidth,
        canvasHeight: exportRenderer.clientHeight,
        height: exportRenderer.clientHeight,
        pixelRatio: 1
      }).then((dataUrl) => {
        triggerDownload(dataUrl, `validator_${editorMode === "ra" ? "ra_" : ""}${question.id}_${question.category.display_number}${question.display_sequence}.png`);
        setExportQuestion(undefined);
        setExportQuery(undefined);
        setExportingStatus(0);
      });

    }); }; // end capture + rAF
    capture();
  }, [evaluatedQuery, exportQuery, exportRendererRef, getTheme, isDarkMode, exportingStatus, question, resetResult, setTheme, exportQuestion, exportView]);

  // Export renderer needs sync evalSql — we compute it eagerly when export is triggered
  const [exportResult, setExportResult] = useState<{ result: Result; isCorrect: boolean } | null>(null);
  const [exportViewResult, setExportViewResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!exportQuestion || !exportQuery || !database) {
      setExportResult(null);
      return;
    }
    const compute = async () => {
      let sqlForExport = exportQuery;
      if (editorMode === "ra") {
        try { sqlForExport = await raToSQL(exportQuery, database); } catch { /* use raw */ }
      }
      const result = await evalSql(sqlForExport);
      const correct = isCorrectResult(exportQuestion.evaluable_result, result) || (exportQuestion.alternative_evaluable_results?.some(alt => isCorrectResult(alt, result)) ?? false);
      setExportResult({ result, isCorrect: correct });
    };
    compute();
  }, [exportQuestion, exportQuery, editorMode, database, evalSql]);

  useEffect(() => {
    if (!exportView || !database) {
      setExportViewResult(null);
      return;
    }
    evalSql(`SELECT * FROM ${exportView.name}`).then(setExportViewResult);
  }, [exportView, database, evalSql]);

  const exportRendererProps = useMemo(() => {
    if (!exportQuestion || !exportQuery || !exportResult) return null;
    return {
      isCorrect: exportResult.isCorrect,
      question: exportQuestion,
      code: exportQuery,
      result: exportResult.result,
      mode: editorMode,
    };
  }, [exportQuestion, exportQuery, exportResult, editorMode]);

  return (
    <div className="App">
      {exportRendererProps && <ExportRenderer query={exportRendererProps} ref={exportRendererRef} />}
      {exportView && exportViewResult && <ExportRenderer view={{view: exportView, result: exportViewResult}} ref={exportRendererRef} />}
      <header className="App-header">
        <div className="my-2"></div>
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <EngineSelector />
          <ThemeToggle setTheme={setTheme} isDarkMode={isDarkMode}></ThemeToggle>
        </div>
        <h1 className="text-6xl font-semibold my-3">SQL Validator</h1>
        <DatabaseLayoutDialog isDarkMode={isDarkMode} />
        <QuestionSelector writtenQuestions={writtenQuestions} correctQuestions={correctQuestions} activeQuestion={question} onSelect={(selectedQuestion) => {loadQuery(question, selectedQuestion); resetResult(); setQuestion(selectedQuestion);}}></QuestionSelector>
        {question && <h2 className="text-2xl font-bold mt-4 mb-2">{t("question")} {question.category.display_number}{question.display_sequence}</h2>}
        <p className="break-words max-w-4xl mb-4 text-left text-base p-2">{question?.description || t("selectQuestion")}</p>

        {/* Query Section with Header */}
        <div className="w-full max-w-4xl">
          <div className="flex justify-between items-center mb-2 px-1">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-base">{t("query")}</span>
              <div className="inline-flex gap-1 text-sm">
                <button
                  onClick={() => switchEditorMode("sql")}
                  className={`px-2 py-0.5 rounded transition-colors ${editorMode === "sql" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}
                >
                  {t("modeSQL")}
                </button>
                <span className="text-gray-300 dark:text-gray-600 select-none">/</span>
                <button
                  onClick={() => switchEditorMode("ra")}
                  className={`px-2 py-0.5 rounded transition-colors ${editorMode === "ra" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"}`}
                >
                  {t("modeRA")}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <EditorSettingsDialog settings={editorSettings} onSettingsChange={setEditorSettings} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("actionsMenu")}>
                    <Settings className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => exportImageQuery()}
                    disabled={!loadedQuestionCorrect}
                  >
                    {t("exportPng")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => importData()}>
                    {t("importData")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportModalRef.current?.openDialog()}>
                    {t("exportData")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {editorMode === "sql" ? (
            <SqlEditor
              id="editor"
              ref={sqlEditorRef}
              value={query ?? (t("selectQuestionComment"))}
              onChange={query !== undefined ? setQuery : undefined}
              schema={dbSchema}
              engine={engine}
              isDarkMode={isDarkMode()}
              disabled={query === undefined}
              readOnly={query === undefined}
              editorSettings={editorSettings}
              className="font-mono w-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-600 border-gray-300 min-h-32 rounded-md overflow-hidden"
            />
          ) : (
            <SqlEditor
              id="ra-editor"
              ref={sqlEditorRef}
              value={query ?? t("raPlaceholder")}
              onChange={query !== undefined ? setQuery : undefined}
              mode="ra"
              engine={engine}
              editorSettings={editorSettings}
              isDarkMode={isDarkMode()}
              disabled={query === undefined}
              readOnly={query === undefined}
              className="font-mono w-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-600 border-gray-300 min-h-32 rounded-md overflow-hidden"
            />
          )}
          {editorMode === "ra" && query !== undefined && <RAPreview code={query} />}
        </div>

        {/* Error/Warning and Action Buttons - Same Row */}
        <div className="flex items-start justify-between mt-3 w-full max-w-4xl">
          {/* Left side - Messages */}
          <div className="space-y-1 text-left">
            {error && (
              <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="font-mono text-sm">{error}</span>
              </div>
            )}
            {correctQueryMismatch && (
              <div className="flex items-start gap-2 text-yellow-600 dark:text-yellow-400">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{t("queryMismatch")}</span>
              </div>
            )}
            {editorMode === "ra"
              ? <RAReference />
              : engine === "postgresql"
                ? <a href="https://www.postgresql.org/docs/current/sql.html" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t("sqlReferencePostgresql")}</a>
                : <a href="https://github.com/Edwinexd/db-sqlite-tools/releases/latest/download/DB_SQLite_Implementation_Tools.pdf" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t("sqlReference")}</a>
            }
          </div>

          {/* Right side - Buttons */}
          <div className="flex gap-3 flex-shrink-0">
            {correctQueryMismatch && (
              <Button
                variant="outline"
                onClick={() => {
                  if (!question) return;
                  setQuery(localStorage.getItem(engineKey(lang, engine, modeKey(`correctQuestionId-${question.id}`, editorMode))) || (editorMode === "ra" ? "" : defaultQuery));
                }}
                className="border-yellow-500 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
              >
                {t("loadSaved")}
              </Button>
            )}
            {editorMode === "sql" && (
              <Button
                variant="outline"
                onClick={() => {
                  if (!query) return;
                  setQuery(format(query, {
                    language: formatterLang,
                    tabWidth: 2,
                    useTabs: false,
                    keywordCase: "upper",
                    dataTypeCase: "upper",
                    functionCase: "upper",
                  }));
                }}
                disabled={!(error === null) || query === undefined}
              >
                {t("formatCode")}
              </Button>
            )}
            <Button
              onClick={runQuery}
              disabled={!(error === null) || query === undefined}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {t("runQuery")}
            </Button>
          </div>
        </div>


        <ExportSelectorModal correctQuestions={correctQuestions} onExport={(include) => exportData({include})} ref={exportModalRef} />
        <ImportDialog
          importedData={pendingImportData}
          onOverwrite={() => {
            if (pendingImportData) applyMergedData(pendingImportData);
          }}
          onMergeApply={(merged) => applyMergedData(merged)}
          ref={importDialogRef}
        />

        {/* Results Section */}
        {result && <>
          {!isViewResult ? question && <>
            {isCorrect ? (
              <div className="flex items-center gap-2 mt-4 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-semibold text-base">{t("matchingResult")}</span>
              </div>
            ) : isCorrect === undefined ? null : (
              <div className="flex items-center gap-2 mt-4 text-red-600 dark:text-red-400">
                <XCircle className="w-6 h-6" />
                <span className="font-semibold text-base">{t("wrongResult")}</span>
              </div>
            )}
            {isCorrect && (
              <p className="text-sm max-w-4xl mb-2 text-left italic text-gray-600 dark:text-gray-400">
                {t("correctButVerify")}
              </p>
            )}
            <div className="flex flex-wrap max-w-full py-4 justify-center gap-4">
              <div className="flex-initial overflow-x-auto">
                <h3 className="text-lg font-bold py-2">{t("actual")}</h3>
                <div className="overflow-x-auto max-w-full">
                  <ResultTable result={result} />
                </div>
              </div>
              <div className="flex-initial overflow-x-auto">
                <h3 className="text-lg font-bold py-2">{t("expected")}</h3>
                <div className="overflow-x-auto max-w-full">
                  <ResultTable result={matchedResult ?? question.evaluable_result} />
                </div>
              </div>
            </div>
          </> : <>
            <h2 className="text-xl font-bold mt-4">{t("viewLabel")} {queryedView}</h2>
            <p className="text-sm max-w-4xl mb-2 text-left italic text-gray-600 dark:text-gray-400">{t("viewQueryLabel", { name: queryedView || "" })}</p>
            <SqlEditor
              value={format(
                views.find(view => view.name === queryedView) ? views.find(view => view.name === queryedView)!.query : "-- View Deleted", {
                  language: formatterLang,
                  tabWidth: 2,
                  useTabs: false,
                  keywordCase: "upper",
                  dataTypeCase: "upper",
                  functionCase: "upper",
                })}
              readOnly={true}
              engine={engine}
              isDarkMode={isDarkMode()}
              className="font-mono w-full dark:bg-slate-800 bg-slate-100 max-w-4xl min-h-32 rounded-md my-2 overflow-hidden"
            />
            <p className="text-sm max-w-4xl mb-2 text-left italic text-gray-600 dark:text-gray-400">{t("viewResultLabel", { name: queryedView || "" })}</p>
            <div className="overflow-x-auto max-w-full">
              <ResultTable result={result} />
            </div>
          </>}
        </>}

        {/* Views Section */}
        <div className="w-full max-w-4xl mt-6">
          <Button
            variant="ghost"
            onClick={() => {
              if (showViewsTable && queryedView) {
                resetResult();
              }
              setDisplayViewsTable(!showViewsTable);
            }}
            className="flex items-center gap-2 text-base font-semibold hover:text-blue-600 dark:hover:text-blue-400 px-0"
          >
            {showViewsTable ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            <span>{t("views")}</span>
            <span className="text-sm font-normal text-gray-500">({views.length})</span>
          </Button>
          {showViewsTable && views.length > 0 && (
            <div className="mt-3">
              <ViewsTable
                views={views}
                onRemoveView={(name) => deleteView(name)}
                onViewRequest={(name) => getViewResult(name)}
                currentlyQuriedView={queryedView}
                onViewHideRequest={() => resetResult()}
                onViewExportRequest={(name) => exportImageView(name)}
              />
            </div>
          )}
        </div>
        <footer className="text-sm py-6 mt-8 border-t border-gray-200 dark:border-slate-700 w-full max-w-4xl">
          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-gray-600 dark:text-gray-400">
            <span>Copyright &copy; <a href="https://github.com/Edwinexd" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Edwin Sundberg</a> {new Date().getFullYear()}</span>
            <span>-</span>
            <LicenseDialog />
            <a href="https://github.com/Edwinexd/sql-validator/issues" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Report Issue</a>
            <PrivacyNoticeToggle></PrivacyNoticeToggle>
          </div>
        </footer>
      </header>
    </div>
  );
}

export default App;
