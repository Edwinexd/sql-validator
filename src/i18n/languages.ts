/**
 * Registry of available languages.
 * Add new entries here when adding a new language pack.
 */
export type EngineType = "sqlite" | "postgresql";

export interface LanguageInfo {
  code: string;
  displayName: string;
}

export const AVAILABLE_LANGUAGES: LanguageInfo[] = [
  { code: "sv", displayName: "Svenska" },
  { code: "en", displayName: "English" },
];

export const AVAILABLE_ENGINES: { type: EngineType; displayName: string }[] = [
  { type: "sqlite", displayName: "SQLite" },
  { type: "postgresql", displayName: "PostgreSQL" },
];

export const DEFAULT_LANGUAGE = "sv";
