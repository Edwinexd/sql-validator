/**
 * Registry of available languages.
 * Add new entries here when adding a new language pack.
 */
export interface LanguageInfo {
  code: string;
  displayName: string;
}

export const AVAILABLE_LANGUAGES: LanguageInfo[] = [
  { code: "sv", displayName: "Svenska" },
  { code: "en", displayName: "English" },
  { code: "de", displayName: "Deutsch" },
];

export const DEFAULT_LANGUAGE = "sv";
