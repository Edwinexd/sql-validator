/**
 * Bundled UI translations for all languages.
 * Imports from the canonical language definition files to avoid duplication.
 */
import sv from "../../languages/sv";
import en from "../../languages/en";
import de from "../../languages/de";

export const uiStrings: Record<string, Record<string, string>> = {
  sv: sv.ui,
  en: en.ui,
  de: de.ui,
};
