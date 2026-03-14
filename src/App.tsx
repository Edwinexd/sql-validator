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
import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import "./App.css";
import ResultTable from "./ResultTable";

import ExportRenderer from "./ExportRenderer";
import QuestionSelector, { Question } from "./QuestionSelector";

// @ts-expect-error - No types available
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-sql";
import "prismjs/themes/prism.css";
import { format } from "sql-formatter";
import initSqlJs from "sql.js";
import ViewsTable, { View } from "./ViewsTable";

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
import ThemeToggle from "./ThemeToggle";
import useTheme from "./useTheme";
import { isCorrectResult, Result } from "./utils";
import DatabaseLayoutDialog from "./DatabaseLayoutDialog";
import ExportSelectorModal, { ExportSelectorModalHandle } from "./ExportSelectorModal";
import ImportDialog, { ImportDialogHandle } from "./ImportDialog";
import { ParsedSaveData, parseImportFile, getLocalData, detectConflicts } from "./mergeUtils";
import { useLanguage, langKey, getUrlParam, setUrlParam } from "./i18n/context";
import LanguageSelector from "./LanguageSelector";
import { getQuestion } from "./QuestionSelector";

function App() {
  const { lang, t, questions, dbArrayBuffer, defaultQuery, isLoading } = useLanguage();
  const [question, setQuestion] = useState<Question>();
  const [database, setDatabase] = useState<initSqlJs.Database>();
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
  const { getTheme, setTheme, isDarkMode } = useTheme();
  // Exporting functionality / flags
  const [exportView, setExportView] = useState<View>();
  const [exportQuestion, setExportQuestion] = useState<Question>();
  const [exportQuery, setExportQuery] = useState<string | undefined>();
  const [exportingStatus, setExportingStatus] = useState<number>(0);
  const [loadedQuestionCorrect, setLoadedQuestionCorrect] = useState<boolean>(false);
  const exportRendererRef = useRef<HTMLDivElement>(null);

  const editorRef = useRef<Editor>(null);
  const exportModalRef = useRef<ExportSelectorModalHandle>(null);
  const importDialogRef = useRef<ImportDialogHandle>(null);
  const [pendingImportData, setPendingImportData] = useState<ParsedSaveData | null>(null);

  // QuestionSelector needs writtenQuestions and correctQuestions to be able to display the correct state
  const [writtenQuestions, setWrittenQuestions] = useState<number[]>(
    localStorage.getItem(langKey(lang, "writtenQuestions")) ? JSON.parse(localStorage.getItem(langKey(lang, "writtenQuestions"))!) : []
  );
  const [correctQuestions, setCorrectQuestions] = useState<number[]>(
    localStorage.getItem(langKey(lang, "correctQuestions")) ? JSON.parse(localStorage.getItem(langKey(lang, "correctQuestions"))!) : []
  );

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

  // Reload written/correct questions when language changes
  useEffect(() => {
    setWrittenQuestions(
      localStorage.getItem(langKey(lang, "writtenQuestions"))
        ? JSON.parse(localStorage.getItem(langKey(lang, "writtenQuestions"))!)
        : []
    );
    setCorrectQuestions(
      localStorage.getItem(langKey(lang, "correctQuestions"))
        ? JSON.parse(localStorage.getItem(langKey(lang, "correctQuestions"))!)
        : []
    );
  }, [lang]);

  const resetResult = useCallback(() => {
    setResult(undefined);
    setIsCorrect(undefined);
    setEvaluatedQuery(null);
    setIsViewResult(false);
    setQueryedView(null);
  }, []);

  const initDb = useCallback(async () => {
    if (!dbArrayBuffer) return;
    resetResult();
    const SQL = await initSqlJs({
      locateFile: (file) => `/dist/sql.js/${file}`,
    });
    const db = new SQL.Database(new Uint8Array(dbArrayBuffer));
    db.create_function("YEAR", (date: string) => new Date(date).getFullYear());
    db.create_function("MONTH", (date: string) => new Date(date).getMonth() + 1);
    db.create_function("DAY", (date: string) => new Date(date).getDate());
    db.exec("PRAGMA foreign_keys = ON;");
    setDatabase(db);
  }, [resetResult, dbArrayBuffer]);

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
          setQuery(localStorage.getItem(langKey(lang, "questionId-" + resolved.id)) || defaultQuery);
        }
      }
    }
  }, [questions, lang, defaultQuery]);

  // Sync selected question to URL
  useEffect(() => {
    if (question) {
      setUrlParam("q", `${question.category.display_number}${question.display_sequence}`);
    } else if (urlRestoredRef.current) {
      // Only clear ?q= after initial restore, not during it
      setUrlParam("q", null);
    }
  }, [question]);

  useEffect(() => {
    if (!database || !question || query === undefined) {
      return;
    }
    let wq = JSON.parse(localStorage.getItem(langKey(lang, "writtenQuestions")) || "[]");
    const initialLength = wq.length;
    if (query === defaultQuery || query === "") {
      localStorage.removeItem(langKey(lang, "questionId-" + question.id));
      // remove from writtenQuestions if it exists there as well
      const filtered = wq.filter((id: number) => id !== question.id);
      wq = filtered;
    } else {
      localStorage.setItem(langKey(lang, "questionId-" + question.id), query);
      // ensure that questionid is in localstorage writtenQuestions
      if (!wq.includes(question.id)) {
        wq.push(question.id);
      }
    }
    if (wq.length !== initialLength) {
      localStorage.setItem(langKey(lang, "writtenQuestions"), JSON.stringify(wq));
      setWrittenQuestions(wq);
    }

    try {
      // Check for multiple statements
      let stmtCount = 0;
      for (const stmt of database.iterateStatements(query)) {
        stmtCount++;
        stmt.free();
        if (stmtCount > 1) {
          setError(t("multipleStatements"));
          return;
        }
      }
      setError(null);
    } catch (e) {
      // @ts-expect-error - Error.message is a string
      setError(e.message);
    }
  }, [database, query, question, lang, defaultQuery, t]);


  const refreshViews = useCallback((upsert: boolean) => {
    if (!database) {
      return;
    }

    const res = database.exec('SELECT name, sql FROM sqlite_master WHERE type="view"');
    let fetchedViews: View[] = [];
    if (res.length !== 0) {
      const fetched = res[0].values as string[][];
      fetchedViews = fetched.map(([name, query]) => ({ name, query }));
    }

    if (fetchedViews.length - views.length !== 0) {
      setDisplayViewsTable(true);
    }

    if (upsert) {
      localStorage.setItem(langKey(lang, "views"), JSON.stringify(fetchedViews));
    }

    setViews(fetchedViews);

    // Recreate missing views from localStorage
    const storedViews = localStorage.getItem(langKey(lang, "views"));
    if (storedViews) {
      const savedViews: View[] = JSON.parse(storedViews);
      const missingViews = savedViews.filter(
        savedView => !fetchedViews.some(fetchedView => fetchedView.name === savedView.name)
      );
      let recreated = 0;
      for (const view of missingViews) {
        try {
          database.exec(view.query);
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

  const runQuery = useCallback(() => {
    if (!database || query === undefined) {
      return;
    }
    try {
      const res = database.exec(query);
      setIsViewResult(false);
      setQueryedView(null);
      setEvaluatedQuery(query);
      if (res.length !== 0) {
        const { columns, values } = res[0];
        setResult({ columns, data: values });
      } else {
        setResult({columns: [], data: []});
      }
      refreshViews(true);
    } catch (e) {
      // @ts-expect-error - Error.message is a string
      setError(e.message);
    }
  }, [database, query, refreshViews]);

  const evalSql = useCallback((sql: string): Result => {
    if (!database) {
      return { columns: [], data: [] };
    }
    try {
      const res = database.exec(sql);
      let result: Result;
      if (res.length !== 0) {
        const { columns, values } = res[0];
        result = { columns, data: values };
      } else {
        result = {columns: [], data: []};
      }
      return result;
    } catch (e) {
      // @ts-expect-error - Error.message is a string
      alert("Error occurred while evaluating SQL Query internally: " + e.message);
      return { columns: [], data: [] };
    }
  }, [database]);

  const getViewResult = useCallback((name: string) => {
    if (!database) {
      return;
    }
    try {
      const viewQuery = `SELECT * FROM ${name}`;
      const res = database.exec(viewQuery);
      setIsViewResult(true);
      setQueryedView(name);
      setEvaluatedQuery(viewQuery);
      if (res.length !== 0) {
        const { columns, values } = res[0];
        setResult({ columns, data: values });
      } else {
        setResult({columns: [], data: []});
      }
    } catch (e) {
      // @ts-expect-error - Error.message is a string
      setError(e.message);
    }
  }, [database]);

  const deleteView = useCallback((name: string) => {
    if (!database) {
      return;
    }

    if (!window.confirm(t("confirmDeleteView", { name }))) {
      return;
    }

    database.exec(`DROP VIEW ${name}`);
    refreshViews(true);

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
    if (!isCorrectResult(question.evaluable_result, result)) {
      setIsCorrect(false);
      return;
    }
    setIsCorrect(true);

    localStorage.setItem(langKey(lang, `correctQuestionId-${question.id}`), query);
    setCorrectQueryMismatch(false);
    setLoadedQuestionCorrect(true);

    const cq = JSON.parse(localStorage.getItem(langKey(lang, "correctQuestions")) || "[]");
    if (!cq.includes(question.id)) {
      cq.push(question.id);
      localStorage.setItem(langKey(lang, "correctQuestions"), JSON.stringify(cq));
      setCorrectQuestions(cq);
    }
  }, [result, question, query, evaluatedQuery, exportingStatus, lang]);

  // Save query based on question
  const loadQuery = useCallback((_oldQuestion: Question | undefined, newQuestion: Question) => {
    setQuery(localStorage.getItem(langKey(lang, "questionId-" + newQuestion.id)) || defaultQuery);
    // This prevents user from ctrl-z'ing to a different question
    if (editorRef.current) {
      editorRef.current!.session = {history: { stack: [], offset: 0 }};
    }
  }, [setQuery, lang, defaultQuery]);

  // Update mismatch & loadedQuestionCorrect flags when query is changed
  useEffect(() => {
    if (!database || !question || query === undefined) {
      return;
    }

    const correctQuery = localStorage.getItem(langKey(lang, `correctQuestionId-${question.id}`));
    if (!correctQuery) {
      setCorrectQueryMismatch(false);
      setLoadedQuestionCorrect(false);
      return;
    }

    setLoadedQuestionCorrect(true);

    let currentQuery = "";
    try {
      currentQuery = format(query + (query.endsWith(";") ? "" : ";"), {
        language: "sqlite",
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
      language: "sqlite",
      tabWidth: 2,
      useTabs: false,
      keywordCase: "upper",
      dataTypeCase: "upper",
      functionCase: "upper",
    });
    setCorrectQueryMismatch(currentQuery !== correctQueryFormatted);
  }, [database, question, query, lang]);

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
    output += "-- 2\n";
    output += "/* --- END Save Format Version --- */\n";
    output += "/* --- END Metadata --- */\n";

    output += "/* --- BEGIN Validation --- */\n";

    output += "/* --- BEGIN Submission Summary --- */\n";
    const writtenQueries = localStorage.getItem(langKey(lang, "correctQuestions")) || "[]";
    const parsed = JSON.parse(writtenQueries) as number[];
    const questionsString = parsed.filter((id) => options === undefined || (options.include && options.include.includes(id))).map((id) => {
      const category = questions.find(c => c.questions.some(q => q.id === id))!;
      const q = category.questions.find(q => q.id === id)!;
      return { formatted: `${category.display_number}${q.display_sequence}`, number: category.display_number, sequence: q.display_sequence };
    }).sort((a, b) => a.sequence.localeCompare(b.sequence)).sort((a, b) => a.number - b.number).map(q => q.formatted).join(", ");
    output += `-- Written Questions: ${questionsString}\n`;
    output += "/* --- END Submission Summary --- */\n";
    if (views.length > 0) {
      output += "/* --- BEGIN Views --- */\n";
      const viewsString = views.map(view => {
        let out = format(view.query, {
          language: "sqlite",
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

    const queriesStr = localStorage.getItem(langKey(lang, "correctQuestions"));
    if (queriesStr) {
      const parsed = JSON.parse(queriesStr) as number[];
      const sorted = parsed.filter((id) => options === undefined || (options.include && options.include.includes(id))).map((id) => {
        const category = questions.find(c => c.questions.some(q => q.id === id))!;
        const q = category.questions.find(q => q.id === id)!;
        return { category, question: q };
      }).map(({ category, question: q }) => { return { number: category.display_number, sequence: q.display_sequence, id: q.id };})
        .sort((a, b) => a.sequence.localeCompare(b.sequence)).sort((a, b) => a.number - b.number).map(q => q.id);
      const questionQueries = sorted.map((id: number) => {
        const category = questions.find(c => c.questions.some(q => q.id === id))!;
        const q = category.questions.find(q => q.id === id)!;
        const activeQuery = localStorage.getItem(langKey(lang, "correctQuestionId-" + id));
        if (!activeQuery) {
          return "";
        }
        let formatted = `/* --- BEGIN Question ${category.display_number}${q.display_sequence} (REFERENCE: ${q.id}) --- */\n`;
        formatted += format(activeQuery + (activeQuery.endsWith(";") ? "" : ";"), {
          language: "sqlite",
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
    const existingQueries = localStorage.getItem(langKey(lang, "writtenQuestions")) || "[]";
    const existingParsed = JSON.parse(existingQueries) as number[];
    const existingQuestions = existingParsed.map((id) => {
      const category = questions.find(c => c.questions.some(q => q.id === id))!;
      const q = category.questions.find(q => q.id === id)!;
      return { formatted: `${category.display_number}${q.display_sequence}`, number: category.display_number, sequence: q.display_sequence };
    }).sort((a, b) => a.sequence.localeCompare(b.sequence)).sort((a, b) => a.number - b.number).map(q => q.formatted).join(", ");
    output += `-- Written Questions: ${existingQuestions}\n`;
    output += "/* --- END Save Summary --- */\n";
    output += "/* --- BEGIN Raw Queries --- */\n";
    output += "/*\n";
    const allQueries = localStorage.getItem(langKey(lang, "writtenQuestions"));
    if (allQueries) {
      const parsed = JSON.parse(allQueries);
      const queries: { [key: number]: string } = {};
      for (const id of parsed) {
        const activeQuery = localStorage.getItem(langKey(lang, "questionId-" + id));
        if (!activeQuery) {
          continue;
        }
        queries[id] = activeQuery;
      }
      output += JSON.stringify(queries, null, 0).replace(/\*\//g, "\\*/");
    }
    output += "\n*/\n";
    output += "/* --- END Raw Queries --- */\n";
    output += "/* --- BEGIN Correct Raw Queries --- */\n";
    output += "/*\n";
    const allCorrectQueries = localStorage.getItem(langKey(lang, "correctQuestions"));
    if (allCorrectQueries) {
      const parsed = JSON.parse(allCorrectQueries);
      const queries: { [key: number]: string } = {};
      for (const id of parsed) {
        const activeQuery = localStorage.getItem(langKey(lang, "correctQuestionId-" + id));
        if (!activeQuery) {
          continue;
        }
        queries[id] = activeQuery;
      }
      output += JSON.stringify(queries, null, 0).replace(/\*\//g, "\\*/");
    }
    output += "\n*/\n";
    output += "/* --- END Correct Raw Queries --- */\n";
    output += "/* --- BEGIN Raw List Dumps --- */\n";
    output += "-- " + (localStorage.getItem(langKey(lang, "writtenQuestions")) === null ? "[]" : localStorage.getItem(langKey(lang, "writtenQuestions"))) + "\n";
    output += "-- " + (localStorage.getItem(langKey(lang, "correctQuestions")) === null ? "[]" :
      JSON.stringify((JSON.parse(localStorage.getItem(langKey(lang, "correctQuestions"))!) as number[])
        .filter((id) => options === undefined || (options.include && options.include.includes(id))))
    ) + "\n";
    output += "/* --- END Raw List Dumps --- */\n";

    output += "/* --- END Validation --- */\n";
    // Calculate hash of everything within the validation block
    const hashValue = sha256(output.slice(output.indexOf("/* --- BEGIN Validation Block --- */"), output.indexOf("/* --- END Validation Block --- */")));
    output += `/* --- BEGIN Hash --- */\n-- ${hashValue}\n/* --- END Hash --- */\n`;
    output += "/* --- END DO NOT EDIT --- */\n";

    const blob = new Blob([output], { type: "text/sql" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const formattedTimestamp = formatFns(new Date(), "yyyyMMdd_HHmm");
    a.href = url;
    a.download = `validator_${lang}_${formattedTimestamp}.sql`;;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }, [database, views, lang, questions]);

  const applyMergedData = useCallback((merged: ParsedSaveData) => {
    // Clear current data
    const oldWritten: number[] = JSON.parse(localStorage.getItem(langKey(lang, "writtenQuestions")) || "[]");
    oldWritten.forEach(id => localStorage.removeItem(langKey(lang, `questionId-${id}`)));
    const oldCorrect: number[] = JSON.parse(localStorage.getItem(langKey(lang, "correctQuestions")) || "[]");
    oldCorrect.forEach(id => localStorage.removeItem(langKey(lang, `correctQuestionId-${id}`)));
    localStorage.removeItem(langKey(lang, "writtenQuestions"));
    localStorage.removeItem(langKey(lang, "correctQuestions"));

    // Write merged data
    for (const [key, value] of Object.entries(merged.rawQueries)) {
      localStorage.setItem(langKey(lang, `questionId-${key}`), value);
      if (question !== undefined && Number(key) === question.id) {
        setQuery(value);
      }
    }
    for (const [key, value] of Object.entries(merged.correctQueries)) {
      localStorage.setItem(langKey(lang, `correctQuestionId-${key}`), value);
    }

    setWrittenQuestions(merged.writtenQuestionIds);
    setCorrectQuestions(merged.correctQuestionIds);
    localStorage.setItem(langKey(lang, "writtenQuestions"), JSON.stringify(merged.writtenQuestionIds));
    localStorage.setItem(langKey(lang, "correctQuestions"), JSON.stringify(merged.correctQuestionIds));

    // Update views in database
    for (const view of views) {
      database!.exec(`DROP VIEW ${view.name}`);
    }
    for (const view of merged.views) {
      database!.exec(view.query);
    }
    refreshViews(true);
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
        const local = getLocalData(lang);
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

    const toExportQuery = localStorage.getItem(langKey(lang, `correctQuestionId-${question.id}`));
    if (!toExportQuery) {
      return;
    }

    setExportQuery(toExportQuery);
    setExportQuestion(question);
  }, [exportView, loadedQuestionCorrect, question, lang]);

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
      triggerDownload(dataUrl, `validator_${question.id}_${question.category.display_number}${question.display_sequence}.png`);
      setExportQuestion(undefined);
      setExportQuery(undefined);
      setExportingStatus(0);
    });
  }, [evaluatedQuery, exportQuery, exportRendererRef, getTheme, isDarkMode, exportingStatus, question, resetResult, setTheme, exportQuestion, exportView]);

  if (isLoading) {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="text-6xl font-semibold my-3">SQL Validator</h1>
          <p className="text-base text-gray-500">Loading...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      {exportQuestion && exportQuery && <ExportRenderer query={{isCorrect: isCorrectResult(exportQuestion.evaluable_result, evalSql(exportQuery)), question: exportQuestion, code: exportQuery, result: evalSql(exportQuery)}} ref={exportRendererRef} />}
      {exportView && <ExportRenderer view={{view: exportView, result: evalSql(`SELECT * FROM ${exportView.name}`)}} ref={exportRendererRef} />}
      <header className="App-header">
        <div className="my-2"></div>
        <div className="flex items-center gap-3">
          <LanguageSelector />
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
            <span className="font-semibold text-base">{t("query")}</span>
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
          {query === undefined ?
            <Editor
              id="placeholder-editor"
              itemID="placeholder-editor"
              value={t("selectQuestionComment")}
              disabled={true}
              onValueChange={_code => null}
              highlight={code => highlight(code, languages.sql)}
              padding={10}
              tabSize={2}
              className="font-mono text-base w-full dark:bg-slate-800 bg-slate-100 min-h-32 rounded-md"
              ref={editorRef}
            />
            :
            <Editor
              id="editor"
              itemID="editor"
              value={query}
              onValueChange={code => setQuery(code)}
              highlight={code => highlight(code, languages.sql)}
              padding={10}
              tabSize={2}
              className="font-mono text-base w-full dark:bg-slate-800 bg-slate-100 border dark:border-slate-600 border-gray-300 min-h-32 rounded-md"
              ref={editorRef}
            />
          }
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
            <a href="https://github.com/Edwinexd/db-sqlite-tools/releases/latest/download/DB_SQLite_Implementation_Tools.pdf" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t("sqlReference")}</a>
          </div>

          {/* Right side - Buttons */}
          <div className="flex gap-3 flex-shrink-0">
            {correctQueryMismatch && (
              <Button
                variant="outline"
                onClick={() => {
                  if (!question) return;
                  setQuery(localStorage.getItem(langKey(lang, `correctQuestionId-${question.id}`)) || defaultQuery);
                }}
                className="border-yellow-500 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
              >
                {t("loadSaved")}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (!query) return;
                setQuery(format(query, {
                  language: "sqlite",
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
            {/* if correct result else display wrong result */}
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
            {/* Two different result tables next to each other, actual and expected */}
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
                  <ResultTable result={question.evaluable_result} />
                </div>
              </div>
            </div>
          </> : <>
            <h2 className="text-xl font-bold mt-4">{t("viewLabel")} {queryedView}</h2>
            <p className="text-sm max-w-4xl mb-2 text-left italic text-gray-600 dark:text-gray-400">{t("viewQueryLabel", { name: queryedView || "" })}</p>
            <Editor
              readOnly={true}
              value={format(
                views.find(view => view.name === queryedView) ? views.find(view => view.name === queryedView)!.query : "-- View Deleted", {
                  language: "sqlite",
                  tabWidth: 2,
                  useTabs: false,
                  keywordCase: "upper",
                  dataTypeCase: "upper",
                  functionCase: "upper",
                })}
              onValueChange={() => null}
              highlight={code => highlight(code, languages.sql)}
              padding={10}
              tabSize={4}
              className="font-mono text-base w-full dark:bg-slate-800 bg-slate-100 max-w-4xl min-h-32 rounded-md my-2"
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
            <a href="https://github.com/Edwinexd/sql-validator?tab=GPL-3.0-1-ov-file" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">GPL-3.0</a>
            <a href="https://github.com/Edwinexd/sql-validator/issues" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Report Issue</a>
            <PrivacyNoticeToggle></PrivacyNoticeToggle>
          </div>
        </footer>
      </header>
    </div>
  );
}

export default App;
