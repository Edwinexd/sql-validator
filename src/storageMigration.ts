const ENGINE_MIGRATION_KEY = "i18n-engine-migrated";
const SQLITE_PREFIX = "sv:sqlite:";

function parseQuestionIds(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(id => Number.isInteger(id))
      ? parsed as number[]
      : null;
  } catch {
    return null;
  }
}

function legacyPrefixFor(key: string): string | null {
  return localStorage.getItem(key) !== null
    ? ""
    : localStorage.getItem(`sv:${key}`) !== null
      ? "sv:"
      : null;
}

function migrateQuestionList(key: "writtenQuestions" | "correctQuestions", queryKey: string): void {
  const targetKey = `${SQLITE_PREFIX}${key}`;
  if (localStorage.getItem(targetKey) !== null) return;

  const prefix = legacyPrefixFor(key);
  if (prefix === null) return;

  const ids = parseQuestionIds(localStorage.getItem(`${prefix}${key}`));
  if (ids === null) return;

  localStorage.setItem(targetKey, JSON.stringify(ids));
  for (const id of ids) {
    const query = localStorage.getItem(`${prefix}${queryKey}-${id}`);
    if (query !== null) {
      localStorage.setItem(`${SQLITE_PREFIX}${queryKey}-${id}`, query);
    }
  }
}

/**
 * Move progress saved before language/engine namespacing to Swedish SQLite.
 * The sv:-only intermediate keys came from an earlier migration and must be
 * supported too, otherwise that migration leaves progress unreachable.
 */
export function migrateLegacySqliteStorage(): void {
  if (localStorage.getItem(ENGINE_MIGRATION_KEY)) return;

  migrateQuestionList("writtenQuestions", "questionId");
  migrateQuestionList("correctQuestions", "correctQuestionId");

  const viewsKey = `${SQLITE_PREFIX}views`;
  if (localStorage.getItem(viewsKey) === null) {
    const prefix = legacyPrefixFor("views");
    if (prefix !== null) {
      const views = localStorage.getItem(`${prefix}views`);
      if (views !== null) localStorage.setItem(viewsKey, views);
    }
  }

  localStorage.setItem(ENGINE_MIGRATION_KEY, "1");
}
