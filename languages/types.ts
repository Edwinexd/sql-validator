/**
 * Canonical table names used as keys throughout the i18n system.
 * Language packs map these to localized table names.
 */
export type CanonicalTable =
  | "Person"
  | "Student"
  | "Teacher"
  | "Course"
  | "CourseInstance"
  | "Participation"
  | "Room";

/**
 * Canonical column names per table.
 */
export interface CanonicalColumns {
  Person: "id" | "name" | "address" | "postalCode" | "city" | "phone";
  Student: "id" | "hasDisability";
  Teacher: "id" | "officeRoom";
  Course: "code" | "name" | "duration" | "price" | "description";
  CourseInstance: "course" | "startDate" | "teacher" | "room";
  Participation: "student" | "course" | "startDate";
  Room: "id" | "name" | "capacity";
}

/**
 * Canonical course keys (internal identifiers, not displayed).
 */
export type CanonicalCourseKey = "c1" | "c2" | "c3" | "c4" | "c5" | "c6";

/**
 * The full language definition that a language pack must provide.
 * The generator uses this + the encrypted oracle to produce
 * per-language questionpool.json and data.sqlite3 files.
 */
export interface LanguageDefinition {
  /** ISO language code, e.g. "sv", "en", "de" */
  code: string;
  /** Display name in the language itself, e.g. "Svenska", "English" */
  displayName: string;

  // ── Data: Names ──────────────────────────────────────────────
  /** First names pool (min 15, indexed by canonical person slot) */
  firstNames: string[];
  /** Last names pool (min 18, indexed by canonical person slot) */
  lastNames: string[];

  // ── Data: Addresses ──────────────────────────────────────────
  /** Street name pool (min 17, indexed by canonical street slot). Numbers are appended by the generator. */
  streets: string[];
  /** City names, exactly 8, indexed by canonical city slot */
  cities: [string, string, string, string, string, string, string, string];

  // ── Data: Per-person ─────────────────────────────────────────
  /** Person IDs, one per person slot (21 entries) */
  personIds: string[];
  /** Postal codes, one per person slot (21 entries) */
  postalCodes: string[];
  /** Phone numbers, one per person slot (21 entries) */
  phones: string[];

  // ── Data: Courses ────────────────────────────────────────────
  /** Course codes, keyed by canonical course key */
  courseCodes: Record<CanonicalCourseKey, string>;
  /** Course display names, keyed by canonical course key */
  courseNames: Record<CanonicalCourseKey, string>;
  /** Course descriptions, keyed by canonical course key */
  courseDescriptions: Record<CanonicalCourseKey, string>;

  // ── Data: Rooms ──────────────────────────────────────────────
  /** Room display names, exactly 5, indexed by room slot */
  roomNames: [string, string, string, string, string];

  // ── Schema translations ──────────────────────────────────────
  /** Maps canonical table names to localized table names */
  tables: Record<CanonicalTable, string>;
  /** Maps canonical column names to localized column names, per table */
  columns: {
    Person: Record<CanonicalColumns["Person"], string>;
    Student: Record<CanonicalColumns["Student"], string>;
    Teacher: Record<CanonicalColumns["Teacher"], string>;
    Course: Record<CanonicalColumns["Course"], string>;
    CourseInstance: Record<CanonicalColumns["CourseInstance"], string>;
    Participation: Record<CanonicalColumns["Participation"], string>;
    Room: Record<CanonicalColumns["Room"], string>;
  };

  // ── Aggregate label ─────────────────────────────────────────
  /** Label used as column name for aggregate expressions (COUNT, SUM, etc.) in expected results */
  aggregateLabel: string;

  // ── Questions ────────────────────────────────────────────────
  /** Localized question descriptions, keyed by question ID (1-110) */
  questionDescriptions: Record<number, string>;

  // ── UI Strings ───────────────────────────────────────────────
  /** All translatable UI strings */
  ui: Record<string, string>;

}
