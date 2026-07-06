/**
 * Oracle data model: contains the canonical structure of the database
 * and reference SQL queries for all questions.
 *
 * This file is encrypted before committing (students shouldn't see the answers).
 */

export interface OraclePerson {
  /** Index into LanguageDefinition.cities */
  cityIndex: number;
  /** Index into LanguageDefinition.firstNames */
  firstNameIndex: number;
  /** Index into LanguageDefinition.lastNames */
  lastNameIndex: number;
  /** Index into LanguageDefinition.streets */
  streetIndex: number;
  /** The number/suffix appended to the street name (e.g. "3", "24", "15b", "112") */
  streetSuffix: string;
  /** Whether this person is a student */
  isStudent: boolean;
  /** Disability flag (0 or 1), only relevant if isStudent */
  disability: number;
  /** Whether this person is a teacher */
  isTeacher: boolean;
  /** Office room number, only relevant if isTeacher */
  officeRoom: number | null;
}

export interface OracleCourse {
  /** Canonical course key (c1-c6) matching LanguageDefinition.courseCodes keys */
  key: string;
  /** Duration in weeks */
  duration: number;
  /** Price */
  price: number;
}

export interface OracleRoom {
  /** Room ID (1-5) */
  id: number;
  /** Room capacity */
  capacity: number;
}

export interface OracleCourseInstance {
  /** Index into OracleData.courses */
  courseIndex: number;
  /** Person slot index of the teacher */
  teacherPersonIndex: number;
  /** Index into OracleData.rooms */
  roomIndex: number;
  /** Start date string (ISO format) */
  startDate: string;
}

export interface OracleParticipation {
  /** Person slot index of the student */
  studentPersonIndex: number;
  /** Index into OracleData.courses */
  courseIndex: number;
  /** Start date matching a CourseInstance for this course */
  startDate: string;
}

export interface OracleQuestion {
  /** Unique question ID (1-110) */
  id: number;
  /** Category ID (1-17) */
  categoryId: number;
  /** Display number shown in UI */
  displayNumber: number;
  /** Display sequence letter (A, B, C, ...) */
  displaySequence: string;
  /**
   * Reference SQL query using canonical placeholders.
   *
   * Placeholder format:
   * - {{table:Person}} -> localized table name
   * - {{col:Person.id}} -> localized column name for Person.id
   * - {{alias:SomeAlias}} -> used for computed column aliases (e.g. AntalKurstillf)
   * - {{city:N}} -> city name at index N
   * - {{courseCode:N}} -> course code for canonical course index N
   * - {{courseName:N}} -> course name for canonical course index N
   * - {{roomName:N}} -> room name at index N
   * - {{roomId:N}} -> room ID number at index N
   * - {{personName:N}} -> full name (first + last) of person at slot N
   * - {{personId:N}} -> person ID at slot N
   */
  query: string;
  /**
   * Alternative reference queries that are also considered correct.
   * Uses the same placeholder format as `query`.
   * The primary `query` result is shown as the expected answer;
   * these alternatives are only used for validation.
   */
  alternativeQueries?: string[];
  /**
   * PostgreSQL-specific reference query, using the same placeholder format.
   * Used instead of `query` when generating for a PostgreSQL-engine language.
   * Only needed when the query differs from the SQLite version (e.g. EXTRACT vs YEAR).
   */
  pgQuery?: string;
  /**
   * PostgreSQL-specific alternative queries.
   * Falls back to `alternativeQueries` if not provided.
   */
  pgAlternativeQueries?: string[];
}

export interface OracleData {
  /** 21 person slot definitions */
  persons: OraclePerson[];
  /** 6 course definitions */
  courses: OracleCourse[];
  /** 5 room definitions */
  rooms: OracleRoom[];
  /** Course instance records */
  courseInstances: OracleCourseInstance[];
  /** Participation records */
  participations: OracleParticipation[];
  /** All 110 questions with reference queries */
  questions: OracleQuestion[];
}
