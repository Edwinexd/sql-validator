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

import { ArrowDownTrayIcon, ArrowUpTrayIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon, InformationCircleIcon, PhotoIcon, XCircleIcon } from "@heroicons/react/24/solid";
import sha256 from "crypto-js/sha256";
import { format as formatFns } from "date-fns";
import { toPng } from "html-to-image";
import PrivacyNoticeToggle from "./PrivacyNoticeToggle";
import questions from "./questions.json";
import ThemeToggle from "./ThemeToggle";
import useTheme from "./useTheme";
import { isCorrectResult, Result } from "./utils";
import DatabaseLayoutDialog from "./DatabaseLayoutDialog";
import ExportSelectorModal, { ExportSelectorModalHandle } from "./ExportSelectorModal";

const DEFAULT_QUERY = "SELECT * FROM student;";

function App() {
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

  // QuestionSelector needs writtenQuestions and correctQuestions to be able to display the correct state
  const [writtenQuestions, setWrittenQuestions] = useState<number[]>(localStorage.getItem("writtenQuestions") ? JSON.parse(localStorage.getItem("writtenQuestions")!) : []);
  const [correctQuestions, setCorrectQuestions] = useState<number[]>(localStorage.getItem("correctQuestions") ? JSON.parse(localStorage.getItem("correctQuestions")!) : []);
  
  const resetResult = useCallback(() => {
    setResult(undefined);
    setIsCorrect(undefined);
    setEvaluatedQuery(null);
    setIsViewResult(false);
    setQueryedView(null);
  }, []);

  const initDb = useCallback(async () => {
    resetResult();
    const sqlPromise = initSqlJs(
      {
        locateFile: (file) => `/dist/sql.js/${file}`,
      }
    );
    const dataPromise = fetch("/data.sqlite3").then((res) => res.arrayBuffer());
    const [SQL, data] = await Promise.all([sqlPromise, dataPromise]);
    const db = new SQL.Database(new Uint8Array(data));
    db.create_function("YEAR", (date: string) => new Date(date).getFullYear());
    db.create_function("MONTH", (date: string) => new Date(date).getMonth() + 1);
    db.create_function("DAY", (date: string) => new Date(date).getDate());
    db.exec("PRAGMA foreign_keys = ON;");
    setDatabase(db);
  }, [resetResult]);

  useEffect(() => {
    initDb();
  }, [initDb]);

  useEffect(() => {
    if (!database || !question || query === undefined) {
      return;
    }
    let writtenQuestions = JSON.parse(localStorage.getItem("writtenQuestions") || "[]");
    const initialLength = writtenQuestions.length;
    if (query === DEFAULT_QUERY || query === "") {
      localStorage.removeItem("questionId-" + question.id);
      // remove from writtenQuestions if it exists there as well
      const filtered = writtenQuestions.filter((id: number) => id !== question.id);
      writtenQuestions = filtered;
    } else {
      localStorage.setItem("questionId-" + question.id, query);
      // ensure that questionid is in localstorage writtenQuestions
      if (!writtenQuestions.includes(question.id)) {
        writtenQuestions.push(question.id);
      }
    }
    if (writtenQuestions.length !== initialLength) {
      localStorage.setItem("writtenQuestions", JSON.stringify(writtenQuestions));
      setWrittenQuestions(writtenQuestions);
    }

    try {
      const stmt = database.prepare(query);
      // Needs to be called per the documentation
      stmt.free();
      setError(null);
    } catch (e) {
      // @ts-expect-error - Error.message is a string
      setError(e.message);
    }
  }, [database, query, question]);


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
      // Force display views table if the amount of views has changed
      // TODO: We may just be able to return with this check, but unsure due import data handling.
      setDisplayViewsTable(true);
    }


    if (upsert) {
      localStorage.setItem("views", JSON.stringify(fetchedViews));
    }

    setViews(fetchedViews);

    // Recreate missing views
    const storedViews = localStorage.getItem("views");
    if (storedViews) {
      const savedViews: View[] = JSON.parse(storedViews);
      const missingViews = savedViews.filter(
        savedView => !fetchedViews.some(fetchedView => fetchedView.name === savedView.name)
      );
      missingViews.forEach(view => {
        database.exec(view.query);
      });
      if (missingViews.length > 0) {
        refreshViews(false); // Refresh views again to update the state after recreating missing views
      }
    }
  }, [database, views.length]);

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

    if (!window.confirm(`Are you sure you want to delete view ${name}?`)) {
      return;
    }

    database.exec(`DROP VIEW ${name}`);
    refreshViews(true);

    if (isViewResult && queryedView === name) {
      resetResult();
    }
  }, [database, isViewResult, queryedView, refreshViews, resetResult]);

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

    localStorage.setItem(`correctQuestionId-${question.id}`, query);
    setCorrectQueryMismatch(false);
    setLoadedQuestionCorrect(true);
    
    const correctQuestions = JSON.parse(localStorage.getItem("correctQuestions") || "[]");
    if (!correctQuestions.includes(question.id)) {
      correctQuestions.push(question.id);
      localStorage.setItem("correctQuestions", JSON.stringify(correctQuestions));
      setCorrectQuestions(correctQuestions);
    }
  }, [result, question, query, evaluatedQuery, exportingStatus]);

  // Save query based on question
  const loadQuery = useCallback((_oldQuestion: Question | undefined, newQuestion: Question) => {
    setQuery(localStorage.getItem("questionId-" + newQuestion.id) || DEFAULT_QUERY);
    // This prevents user from ctrl-z'ing to a different question
    if (editorRef.current) {
      editorRef.current!.session = {history: { stack: [], offset: 0 }};
    }
  }, [setQuery]);

  // Update mismatch & loadedQuestionCorrect flags when query is changed
  useEffect(() => {
    if (!database || !question || query === undefined) {
      return;
    }

    const correctQuery = localStorage.getItem(`correctQuestionId-${question.id}`);
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
  }, [database, question, query]);

  const exportData = useCallback((options?: { include?: number[]}) => {
    if (!database) {
      return;
    }
    let output = "";
    output += "/* --- BEGIN Comments --- */\n";
    output += `-- This file was generated by SQL Validator at ${new Date().toISOString()}\n`;
    output += "-- Do not edit this file manually as it may lead to data corruption!\n";
    output += "-- If you wish to edit anything for your submission, do so in the application and export again.\n";
    output += "/* --- END Comments --- */\n";

    output += "/* --- BEGIN DO NOT EDIT --- */\n";

    output += "/* --- BEGIN Metadata --- */\n";
    output += "/* --- BEGIN Save Format Version --- */\n";
    output += "-- 2\n";
    output += "/* --- END Save Format Version --- */\n";
    output += "/* --- END Metadata --- */\n";

    output += "/* --- BEGIN Validation --- */\n";

    output += "/* --- BEGIN Submission Summary --- */\n";
    const writtenQueries = localStorage.getItem("correctQuestions") || "[]";
    const parsed = JSON.parse(writtenQueries) as number[];
    const questionsString = parsed.filter((id) => options === undefined || (options.include && options.include.includes(id))).map((id) => {
      const category = questions.find(c => c.questions.some(q => q.id === id))!;
      const question = category.questions.find(q => q.id === id)!;
      return { formatted: `${category.display_number}${question.display_sequence}`, number: category.display_number, sequence: question.display_sequence };
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

    const queries = localStorage.getItem("correctQuestions");
    if (queries) {
      const parsed = JSON.parse(queries) as number[];
      const sorted = parsed.filter((id) => options === undefined || (options.include && options.include.includes(id))).map((id) => {
        const category = questions.find(c => c.questions.some(q => q.id === id))!;
        const question = category.questions.find(q => q.id === id)!;
        return { category, question };
      }).map(({ category, question }) => { return { number: category.display_number, sequence: question.display_sequence, id: question.id };})
        .sort((a, b) => a.sequence.localeCompare(b.sequence)).sort((a, b) => a.number - b.number).map(q => q.id);
      const questionQueries = sorted.map((id: number) => {
        const category = questions.find(c => c.questions.some(q => q.id === id))!;
        const question = category.questions.find(q => q.id === id)!;
        const activeQuery = localStorage.getItem("correctQuestionId-" + id);
        if (!activeQuery) {
          return "";
        }
        let formatted = `/* --- BEGIN Question ${category.display_number}${question.display_sequence} (REFERENCE: ${question.id}) --- */\n`;
        formatted += format(activeQuery + (activeQuery.endsWith(";") ? "" : ";"), {
          language: "sqlite",
          tabWidth: 2,
          useTabs: false,
          keywordCase: "upper",
          dataTypeCase: "upper",
          functionCase: "upper",
        });
        formatted += `\n/* --- END Question ${category.display_number}${question.display_sequence} (REFERENCE: ${question.id}) --- */`;
        return formatted;
      }).join("\n");
      output += questionQueries;
      output += "\n";
    }
    output += "/* --- END Submission Queries --- */\n";
    
    output += "/* --- BEGIN Save Summary --- */\n";
    const existingQueries = localStorage.getItem("writtenQuestions") || "[]";
    const existingParsed = JSON.parse(existingQueries) as number[];
    const existingQuestions = existingParsed.map((id) => {
      const category = questions.find(c => c.questions.some(q => q.id === id))!;
      const question = category.questions.find(q => q.id === id)!;
      return { formatted: `${category.display_number}${question.display_sequence}`, number: category.display_number, sequence: question.display_sequence };
    }).sort((a, b) => a.sequence.localeCompare(b.sequence)).sort((a, b) => a.number - b.number).map(q => q.formatted).join(", ");
    output += `-- Written Questions: ${existingQuestions}\n`;
    output += "/* --- END Save Summary --- */\n";
    output += "/* --- BEGIN Raw Queries --- */\n";
    output += "/*\n";
    const allQueries = localStorage.getItem("writtenQuestions");
    if (allQueries) {
      const parsed = JSON.parse(allQueries);
      const queries: { [key: number]: string } = {};
      for (const id of parsed) {
        const activeQuery = localStorage.getItem("questionId-" + id);
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
    const allCorrectQueries = localStorage.getItem("correctQuestions");
    if (allCorrectQueries) {
      const parsed = JSON.parse(allCorrectQueries);
      const queries: { [key: number]: string } = {};
      for (const id of parsed) {
        const activeQuery = localStorage.getItem("correctQuestionId-" + id);
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
    output += "-- " + (localStorage.getItem("writtenQuestions") === null ? "[]" : localStorage.getItem("writtenQuestions")) + "\n";
    output += "-- " + (localStorage.getItem("correctQuestions") === null ? "[]" : 
      JSON.stringify((JSON.parse(localStorage.getItem("correctQuestions")!) as number[])
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
    a.download = `validator_${formattedTimestamp}.sql`;;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }, [database, views]);

  const upsertData = useCallback((data: string) => {
    // Extract raw queries
    const rawQueries = data.match(/\/\*\s--- BEGIN Raw Queries --- \*\/\n\/\*\n([\s\S]*?)\n\*\/\n\/\*\s--- END Raw Queries --- \*\//)![1];
    const parsedQueries: { [key: string]: string } = JSON.parse(rawQueries.replace(/\\\*\//g, "*/"));

    // Correct raw queries
    const correctRawQueries = data.match(/\/\*\s--- BEGIN Correct Raw Queries --- \*\/\n\/\*\n([\s\S]*?)\n\*\/\n\/\*\s--- END Correct Raw Queries --- \*\//)![1];
    const parsedCorrectQueries: { [key: string]: string } = JSON.parse(correctRawQueries.replace(/\\\*\//g, "*/"));
    
    // Clear current data
    const writtenQuestions: number[] = JSON.parse(localStorage.getItem("writtenQuestions") || "[]");
    writtenQuestions.forEach(id => {
      localStorage.removeItem(`questionId-${id}`);
    });

    const correctQuestions: number[] = JSON.parse(localStorage.getItem("correctQuestions") || "[]");
    correctQuestions.forEach(id => {
      localStorage.removeItem(`correctQuestionId-${id}`);
    });

    localStorage.removeItem("writtenQuestions");
    localStorage.removeItem("correctQuestions");
    
    // Insert new data
    for (const [key, value] of Object.entries(parsedQueries)) {
      localStorage.setItem(`questionId-${key}`, value);
      if (question !== undefined && Number(key) === question.id) {
        setQuery(value);
      }
    }

    for (const [key, value] of Object.entries(parsedCorrectQueries)) {
      localStorage.setItem(`correctQuestionId-${key}`, value);
    }
    
    // Extract and load raw list dumps
    const rawLists = data.match(/\/\*\s--- BEGIN Raw List Dumps --- \*\/\n--\s(.*)\n--\s(.*)\n\/\*\s--- END Raw List Dumps --- \*\//)!;
    

    const newWrittenQuestions = JSON.parse(rawLists[1]);
    const newCorrectQuestions = JSON.parse(rawLists[2]);
    setWrittenQuestions(newWrittenQuestions);
    setCorrectQuestions(newCorrectQuestions);
    localStorage.setItem("writtenQuestions", JSON.stringify(newWrittenQuestions));
    localStorage.setItem("correctQuestions", JSON.stringify(newCorrectQuestions));
    
    // Upsert views
    // Delete all current views
    for (const view of views) {
      database!.exec(`DROP VIEW ${view.name}`);
    }

    const viewsBlock = data.match(/\/\*\s--- BEGIN Views --- \*\/\n([\s\S]*?)\n\/\*\s--- END Views --- \*\//);
    if (viewsBlock) {
      const viewsData = viewsBlock[1];
      const newViews = viewsData.match(/\/\*\s--- BEGIN View (.*) --- \*\/\n([\s\S]*?)\n\/\*\s--- END View (.*) --- \*\//g)!;
      for (const view of newViews) {
        // const viewName = view.match(/\/\*\s--- BEGIN View (.*) --- \*\//)![1];
        const viewQuery = view.match(/\/\*\s--- BEGIN View (.*) --- \*\/\n([\s\S]*?)\n\/\*\s--- END View (.*) --- \*\//)![2];
        database!.exec(viewQuery);
      }
    }

    refreshViews(true);
  }, [database, question, refreshViews, views]);

  const importData = useCallback(() => {
    // Confirm that the user wants to import data, it will overwrite the current data
    if (!window.confirm("Are you sure you want to import data?\n\nNote: This will overwrite your current data.")) {
      return;
    }

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
        upsertData(data);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [upsertData]);

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

    const toExportQuery = localStorage.getItem(`correctQuestionId-${question.id}`);
    if (!toExportQuery) {
      return;
    }

    setExportQuery(toExportQuery);
    setExportQuestion(question);
  }, [exportView, loadedQuestionCorrect, question]);

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

    // TODO: I'm not really a fan of this solution but without it the browser crashes due to downloading an extreme amount of files
    setExportingStatus(1);

    // View
    if (exportView) {
      toPng(exportRendererRef.current, { 
        canvasWidth: exportRendererRef.current.clientWidth,
        width: exportRendererRef.current.clientWidth,
        canvasHeight: exportRendererRef.current.clientHeight,
        height: exportRendererRef.current.clientHeight,
        pixelRatio: 1 
      }).then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `validator_${exportView.name}.png`;
        link.href = dataUrl;
        link.click();
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
      const link = document.createElement("a");
      link.download = `validator_${question.id}_${question.category.display_number}${question.display_sequence}.png`;
      link.href = dataUrl;
      link.click();
      setExportQuestion(undefined);
      setExportQuery(undefined);
      setExportingStatus(0);
    });
  }, [evaluatedQuery, exportQuery, exportRendererRef, getTheme, isDarkMode, exportingStatus, question, resetResult, setTheme, exportQuestion, exportView]);

  const questionLabel = question ? `Fråga ${question.category.display_number}${question.display_sequence}` : "Select a question to get started!";
  const questionDescription = question?.description || "Select a question to get started!";
  const outlineButtonClasses = "inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-slate-400 dark:hover:border-slate-500 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors";
  const primaryButtonClasses = "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-base font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors";
  const accentButtonClasses = "inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors";
  const statusContent = !isViewResult && result ? (
    isCorrect ? (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
        <CheckCircleIcon className="h-6 w-6" />
        <span>Matching result!</span>
      </div>
    ) : isCorrect === undefined ? (
      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300 font-semibold">
        <InformationCircleIcon className="h-6 w-6" />
        <span>Result evaluated</span>
      </div>
    ) : (
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold">
        <XCircleIcon className="h-6 w-6" />
        <span>Wrong result!</span>
      </div>
    )
  ) : null;

  return (
    <div className="App min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {exportQuestion && exportQuery && <ExportRenderer query={{isCorrect: isCorrectResult(exportQuestion.evaluable_result, evalSql(exportQuery)), question: exportQuestion, code: exportQuery, result: evalSql(exportQuery)}} ref={exportRendererRef} />}
      {exportView && <ExportRenderer view={{view: exportView, result: evalSql(`SELECT * FROM ${exportView.name}`)}} ref={exportRendererRef} />}
      <header className="App-header">
        <div className="w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col items-center gap-6">
          <div className="w-full flex justify-end">
            <ThemeToggle setTheme={setTheme} isDarkMode={isDarkMode}></ThemeToggle>
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold text-center">SQL Validator</h1>
          <div className="w-full max-w-4xl rounded-3xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <DatabaseLayoutDialog isDarkMode={isDarkMode} />
          </div>
          <QuestionSelector writtenQuestions={writtenQuestions} correctQuestions={correctQuestions} onSelect={(selectedQuestion) => {loadQuery(question, selectedQuestion); resetResult(); setQuestion(selectedQuestion);}}></QuestionSelector>

          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-5">
            <div className="text-left space-y-1">
              <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">Question</p>
              <h2 className="text-3xl font-semibold">{questionLabel}</h2>
              <p className="text-base text-slate-700 dark:text-slate-200 leading-relaxed">{questionDescription}</p>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="bg-slate-200 dark:bg-slate-800 text-left px-4 py-2 font-semibold text-slate-800 dark:text-slate-100">
                Query
              </div>
              <div className="bg-[#eaf3ff] dark:bg-slate-900">
                {query === undefined ? 
                  <Editor
                    id="placeholder-editor"
                    itemID="placeholder-editor"
                    value={"-- Select a question to get started!"}
                    disabled={true}
                    onValueChange={_code => null}
                    highlight={code => highlight(code, languages.sql)}
                    padding={12}
                    tabSize={2}
                    className="font-mono text-lg w-full bg-transparent min-h-[12rem] focus:outline-none"
                    ref={editorRef}
                  />
                  : 
                  <Editor
                    id="editor"
                    itemID="editor"
                    value={query}
                    onValueChange={code => setQuery(code)}
                    highlight={code => highlight(code, languages.sql)}
                    padding={12}
                    tabSize={2}
                    className="font-mono text-lg w-full bg-transparent min-h-[12rem] focus:outline-none"
                    ref={editorRef}
                  />
                }
              </div>
            </div>

            {error && <p className="font-mono text-red-600 dark:text-red-400 text-sm break-all">{error}</p>}
            {correctQueryMismatch &&
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-medium">
                <InformationCircleIcon className="h-5 w-5" />
                <span>Current SQL differs from the saved correct version. Run the query to register it as correct.</span>
              </div>
            }

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-h-[28px]">{statusContent}</div>
              <div className="flex flex-wrap gap-3 justify-end">
                <button onClick={() => {
                  if (!query) {
                    return;
                  }
                  setQuery(format(query, {
                    language: "sqlite",
                    tabWidth: 2,
                    useTabs: false,
                    keywordCase: "upper",
                    dataTypeCase: "upper",
                    functionCase: "upper",
                  }));}} disabled={!(error === null) || query === undefined} className={`${outlineButtonClasses} disabled:opacity-50`} type="submit">
                  Format Code
                </button>
                <button onClick={runQuery} disabled={!(error === null) || query === undefined} className={primaryButtonClasses} type="submit">Run Query</button>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-wrap gap-3">
              <button onClick={() => exportModalRef.current?.openDialog()} className={outlineButtonClasses} type="submit">
                <ArrowDownTrayIcon className="h-5 w-5" />
                <span>Export Data</span>
              </button>
              <ExportSelectorModal correctQuestions={correctQuestions} onExport={(include) => exportData({include})} ref={exportModalRef} />
              <button onClick={importData} className={outlineButtonClasses} type="submit">
                <ArrowUpTrayIcon className="h-5 w-5" />
                <span>Import Data</span>
              </button>
              <button 
                onClick={() => {
                  if (showViewsTable && queryedView) {
                    resetResult();
                  }
                  setDisplayViewsTable(!showViewsTable);
                }} 
                className={outlineButtonClasses}
              >
                {showViewsTable ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                <span>{showViewsTable ? "Hide Views" : "Show Views"}</span>
              </button>
              <button onClick={exportImageQuery} className={accentButtonClasses} type="submit" disabled={!loadedQuestionCorrect}>
                <PhotoIcon className="h-5 w-5" />
                <span>Export PNG</span>
              </button>
            </div>
          </div>

          {showViewsTable && (
            <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
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

          {result && (
            <section className="w-full max-w-5xl flex flex-col gap-6">
              {!isViewResult ? question && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                      <h2 className="text-2xl font-semibold mb-3">Actual</h2>
                      <div className="overflow-x-auto">
                        <ResultTable result={result} forceFixedSizes />
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                      <h2 className="text-2xl font-semibold mb-3">Expected</h2>
                      <div className="overflow-x-auto">
                        <ResultTable result={question.evaluable_result} forceFixedSizes />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 italic px-1">Make sure joins are complete and the query only uses information from the assignment before exporting.</p>
                </>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                  <h2 className="text-2xl font-semibold">View {queryedView}</h2>
                  <p className="text-base text-slate-700 dark:text-slate-200 mt-1">This is the query for view {queryedView}.</p>
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
                    padding={12}
                    tabSize={4}
                    className="font-mono text-lg w-full bg-[#eaf3ff] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl my-3"
                  />
                  <p className="text-base text-slate-700 dark:text-slate-200 italic">... and this is the result of querying it with SELECT * FROM {queryedView};</p>
                  <div className="overflow-x-auto mt-2">
                    <ResultTable result={result} forceFixedSizes />
                  </div>
                </div>
              )}
            </section>
          )}

          <footer className="text-lg py-6 w-full text-center">
            <div className="flex flex-wrap mx-2 justify-center items-center gap-x-8 gap-y-4">
              <p>Copyright &copy; <a href="https://github.com/Edwinexd" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">Edwin Sundberg</a> {new Date().getFullYear()} - <a href="https://github.com/Edwinexd/sql-validator?tab=GPL-3.0-1-ov-file" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">GPL-3.0</a></p>              
              <p><a href="https://github.com/Edwinexd/sql-validator/issues" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">Report issues</a></p>
              <PrivacyNoticeToggle></PrivacyNoticeToggle>
            </div>
          </footer>
        </div>
      </header>
    </div>
  );
}

export default App;
