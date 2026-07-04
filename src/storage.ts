// Deploy-base-aware storage and asset helpers.
//
// The app is served both at the site root ("/") and as immutable, dated
// "compatibility" builds under "/compatibility/<YYYY-MM-DD>/". On Cloudflare
// Pages these all share one origin, so without namespacing they would share the
// same localStorage and fetch each other's data. Deriving a key prefix and an
// asset prefix from the Vite base path keeps every build isolated:
//   base "/"                          -> prefix ""                    (unchanged; existing users keep their data)
//   base "/compatibility/2026-07-04/" -> prefix "compatibility:2026-07-04:"

/** Vite base path; always starts and ends with "/" (e.g. "/" or "/compatibility/2026-07-04/"). */
export const BASE_URL: string = import.meta.env.BASE_URL || "/";

/** localStorage key prefix derived from the base path ("" at the site root). */
export const STORAGE_PREFIX: string = BASE_URL.replace(/^\/+|\/+$/g, "").replace(/\//g, ":");

const withPrefix = (key: string): string =>
  STORAGE_PREFIX ? `${STORAGE_PREFIX}:${key}` : key;

/** localStorage wrapper that namespaces every key by the deploy base path. */
export const storage = {
  getItem: (key: string): string | null => localStorage.getItem(withPrefix(key)),
  setItem: (key: string, value: string): void => localStorage.setItem(withPrefix(key), value),
  removeItem: (key: string): void => localStorage.removeItem(withPrefix(key)),
  has: (key: string): boolean => withPrefix(key) in localStorage,
};

/** Resolve a public asset path against the deploy base so dated builds load their own frozen assets. */
export function asset(path: string): string {
  return BASE_URL + path.replace(/^\/+/, "");
}
