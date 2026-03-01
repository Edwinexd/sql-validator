import { View } from "./ViewsTable";

export interface ParsedSaveData {
  rawQueries: Record<string, string>;
  correctQueries: Record<string, string>;
  writtenQuestionIds: number[];
  correctQuestionIds: number[];
  views: View[];
}

export interface MergeConflict {
  type: "rawQuery" | "correctQuery" | "view";
  key: string;
  localValue: string;
  importedValue: string;
}

export interface MergeAnalysis {
  addRawQueries: Record<string, string>;
  addCorrectQueries: Record<string, string>;
  addViews: View[];
  keepRawQueries: Record<string, string>;
  keepCorrectQueries: Record<string, string>;
  keepViews: View[];
  conflicts: MergeConflict[];
  identicalCount: number;
}

export type ConflictResolution = "local" | "imported";

function normalize(s: string): string {
  return s.trim().replace(/;+$/, "").trim();
}

export function parseImportFile(data: string): ParsedSaveData {
  const rawQueriesMatch = data.match(
    /\/\*\s--- BEGIN Raw Queries --- \*\/\n\/\*\n([\s\S]*?)\n\*\/\n\/\*\s--- END Raw Queries --- \*\//
  );
  const rawQueries: Record<string, string> = rawQueriesMatch
    ? JSON.parse(rawQueriesMatch[1].replace(/\\\*\//g, "*/"))
    : {};

  const correctQueriesMatch = data.match(
    /\/\*\s--- BEGIN Correct Raw Queries --- \*\/\n\/\*\n([\s\S]*?)\n\*\/\n\/\*\s--- END Correct Raw Queries --- \*\//
  );
  const correctQueries: Record<string, string> = correctQueriesMatch
    ? JSON.parse(correctQueriesMatch[1].replace(/\\\*\//g, "*/"))
    : {};

  const rawListsMatch = data.match(
    /\/\*\s--- BEGIN Raw List Dumps --- \*\/\n--\s(.*)\n--\s(.*)\n\/\*\s--- END Raw List Dumps --- \*\//
  );
  const writtenQuestionIds: number[] = rawListsMatch
    ? JSON.parse(rawListsMatch[1])
    : [];
  const correctQuestionIds: number[] = rawListsMatch
    ? JSON.parse(rawListsMatch[2])
    : [];

  const views: View[] = [];
  const viewsBlock = data.match(
    /\/\*\s--- BEGIN Views --- \*\/\n([\s\S]*?)\n\/\*\s--- END Views --- \*\//
  );
  if (viewsBlock) {
    const viewMatches = viewsBlock[1].matchAll(
      /\/\*\s--- BEGIN View (.*?) --- \*\/\n([\s\S]*?)\n\/\*\s--- END View .*? --- \*\//g
    );
    for (const match of viewMatches) {
      views.push({ name: match[1], query: match[2] });
    }
  }

  return { rawQueries, correctQueries, writtenQuestionIds, correctQuestionIds, views };
}

export function getLocalData(): ParsedSaveData {
  const writtenQuestionIds: number[] = JSON.parse(
    localStorage.getItem("writtenQuestions") || "[]"
  );
  const correctQuestionIds: number[] = JSON.parse(
    localStorage.getItem("correctQuestions") || "[]"
  );

  const rawQueries: Record<string, string> = {};
  for (const id of writtenQuestionIds) {
    const q = localStorage.getItem(`questionId-${id}`);
    if (q) rawQueries[String(id)] = q;
  }

  const correctQueries: Record<string, string> = {};
  for (const id of correctQuestionIds) {
    const q = localStorage.getItem(`correctQuestionId-${id}`);
    if (q) correctQueries[String(id)] = q;
  }

  const views: View[] = JSON.parse(localStorage.getItem("views") || "[]");

  return { rawQueries, correctQueries, writtenQuestionIds, correctQuestionIds, views };
}

export function detectConflicts(
  local: ParsedSaveData,
  imported: ParsedSaveData
): MergeAnalysis {
  const addRawQueries: Record<string, string> = {};
  const keepRawQueries: Record<string, string> = {};
  const addCorrectQueries: Record<string, string> = {};
  const keepCorrectQueries: Record<string, string> = {};
  const addViews: View[] = [];
  const keepViews: View[] = [];
  const conflicts: MergeConflict[] = [];
  let identicalCount = 0;

  // Raw queries
  const allRawKeys = new Set([
    ...Object.keys(local.rawQueries),
    ...Object.keys(imported.rawQueries),
  ]);
  for (const key of allRawKeys) {
    const localVal = local.rawQueries[key];
    const importedVal = imported.rawQueries[key];
    if (localVal && !importedVal) {
      keepRawQueries[key] = localVal;
    } else if (!localVal && importedVal) {
      addRawQueries[key] = importedVal;
    } else if (localVal && importedVal) {
      if (normalize(localVal) === normalize(importedVal)) {
        identicalCount++;
      } else {
        conflicts.push({
          type: "rawQuery",
          key,
          localValue: localVal,
          importedValue: importedVal,
        });
      }
    }
  }

  // Correct queries — never produce conflicts, follow rawQuery resolution
  const rawConflictKeys = new Set(
    conflicts.filter((c) => c.type === "rawQuery").map((c) => c.key)
  );
  const allCorrectKeys = new Set([
    ...Object.keys(local.correctQueries),
    ...Object.keys(imported.correctQueries),
  ]);
  for (const key of allCorrectKeys) {
    if (rawConflictKeys.has(key)) continue; // resolved alongside rawQuery
    const localVal = local.correctQueries[key];
    const importedVal = imported.correctQueries[key];
    if (localVal && !importedVal) {
      keepCorrectQueries[key] = localVal;
    } else if (!localVal && importedVal) {
      addCorrectQueries[key] = importedVal;
    } else if (localVal && importedVal) {
      if (normalize(localVal) === normalize(importedVal)) {
        identicalCount++;
      } else {
        // No conflict — prefer imported (newer)
        addCorrectQueries[key] = importedVal;
      }
    }
  }

  // Views
  const localViewMap = new Map(local.views.map((v) => [v.name, v]));
  const importedViewMap = new Map(imported.views.map((v) => [v.name, v]));
  const allViewNames = new Set([
    ...localViewMap.keys(),
    ...importedViewMap.keys(),
  ]);
  for (const name of allViewNames) {
    const localView = localViewMap.get(name);
    const importedView = importedViewMap.get(name);
    if (localView && !importedView) {
      keepViews.push(localView);
    } else if (!localView && importedView) {
      addViews.push(importedView);
    } else if (localView && importedView) {
      if (normalize(localView.query) === normalize(importedView.query)) {
        identicalCount++;
      } else {
        conflicts.push({
          type: "view",
          key: name,
          localValue: localView.query,
          importedValue: importedView.query,
        });
      }
    }
  }

  return {
    addRawQueries,
    addCorrectQueries,
    addViews,
    keepRawQueries,
    keepCorrectQueries,
    keepViews,
    conflicts,
    identicalCount,
  };
}

export function buildMergedData(
  local: ParsedSaveData,
  imported: ParsedSaveData,
  analysis: MergeAnalysis,
  resolutions: Record<string, ConflictResolution>
): ParsedSaveData {
  const rawQueries: Record<string, string> = {};
  const correctQueries: Record<string, string> = {};
  const views: View[] = [];

  // Keep identical entries from local (they're the same in both)
  for (const key of Object.keys(local.rawQueries)) {
    if (imported.rawQueries[key] && normalize(local.rawQueries[key]) === normalize(imported.rawQueries[key])) {
      rawQueries[key] = local.rawQueries[key];
    }
  }
  for (const key of Object.keys(local.correctQueries)) {
    if (imported.correctQueries[key] && normalize(local.correctQueries[key]) === normalize(imported.correctQueries[key])) {
      correctQueries[key] = local.correctQueries[key];
    }
  }
  {
    const importedViewMap = new Map(imported.views.map((v) => [v.name, v]));
    for (const v of local.views) {
      const imp = importedViewMap.get(v.name);
      if (imp && normalize(v.query) === normalize(imp.query)) {
        views.push(v);
      }
    }
  }

  // Auto-keep (only in local)
  Object.assign(rawQueries, analysis.keepRawQueries);
  Object.assign(correctQueries, analysis.keepCorrectQueries);
  views.push(...analysis.keepViews);

  // Auto-add (only in imported)
  Object.assign(rawQueries, analysis.addRawQueries);
  Object.assign(correctQueries, analysis.addCorrectQueries);
  views.push(...analysis.addViews);

  // Resolved conflicts
  for (const conflict of analysis.conflicts) {
    const resolution = resolutions[`${conflict.type}:${conflict.key}`];
    const value = resolution === "imported" ? conflict.importedValue : conflict.localValue;
    if (conflict.type === "rawQuery") {
      rawQueries[conflict.key] = value;
      // Correct query follows the same resolution
      const localCorrect = local.correctQueries[conflict.key];
      const importedCorrect = imported.correctQueries[conflict.key];
      if (resolution === "imported" && importedCorrect) {
        correctQueries[conflict.key] = importedCorrect;
      } else if (localCorrect) {
        correctQueries[conflict.key] = localCorrect;
      }
    } else if (conflict.type === "view") {
      views.push({ name: conflict.key, query: value });
    }
  }

  // Build question ID lists
  const writtenQuestionIds = Array.from(
    new Set([...local.writtenQuestionIds, ...imported.writtenQuestionIds])
  ).filter((id) => String(id) in rawQueries);

  const correctQuestionIds = Array.from(
    new Set([...local.correctQuestionIds, ...imported.correctQuestionIds])
  ).filter((id) => String(id) in correctQueries);

  return { rawQueries, correctQueries, writtenQuestionIds, correctQuestionIds, views };
}
