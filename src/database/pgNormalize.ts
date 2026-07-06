/**
 * Normalize a PostgreSQL (PGlite) value so it matches the shape the app compares
 * against. Result comparison (`isCorrectResult`) is strictly typed, and the default
 * SQLite engine returns plain JS numbers/strings. PostgreSQL is more type-faithful:
 * it hands back `Date` objects, real booleans, and — crucially — NUMERIC/DECIMAL and
 * BIGINT as *strings*. Left untouched those diverge from both the SQLite engine and
 * the generated PG oracle, so we coerce them here.
 *
 * The numeric coercion is TYPE-AWARE (keyed on the column's PostgreSQL OID) on purpose:
 * text columns that merely look numeric (personnummer, postal codes) must NOT be turned
 * into numbers. Only genuine NUMERIC/BIGINT columns are coerced.
 *
 * This helper is shared by the live engine (`pgliteEngine.ts`) and the offline oracle
 * generator (`scripts/generate-language.ts`) so the two can never drift apart.
 */

// PostgreSQL type OIDs (from pg_catalog.pg_type).
const OID_INT8 = 20; // bigint — also what COUNT()/SUM(int) report
const OID_NUMERIC = 1700; // numeric/decimal, and the result type of AVG() and EXTRACT()

export function normalizePgValue(val: unknown, dataTypeID?: number): unknown {
  if (val === null || val === undefined) return null;
  // DATE / TIMESTAMP come back as JS Date → "YYYY-MM-DD" (matches SQLite's text dates).
  if (val instanceof Date) return val.toISOString().split("T")[0];
  // BOOLEAN → 0/1 (SQLite has no boolean type; it stores 0/1).
  if (typeof val === "boolean") return val ? 1 : 0;
  // PGlite returns NUMERIC/DECIMAL and (out-of-range) BIGINT as strings; SQLite returns
  // them as JS numbers. Coerce, but only for genuinely numeric column types.
  if (
    typeof val === "string" &&
    (dataTypeID === OID_NUMERIC || dataTypeID === OID_INT8) &&
    val.trim() !== ""
  ) {
    const n = Number(val);
    if (!Number.isNaN(n)) return n;
  }
  // bigint primitive (if PGlite ever returns one) → number.
  if (typeof val === "bigint") return Number(val);
  return val;
}
