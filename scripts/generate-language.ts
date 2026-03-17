/**
 * Language generator: produces per-language questionpool.json and data.sqlite3.
 *
 * Usage: npx tsx scripts/generate-language.ts --lang <code> [--password <pw> | --plain]
 *   or:  npx tsx scripts/generate-language.ts --all [--password <pw> | --plain]
 *         (--all auto-discovers all language files in languages/)
 */
import { createDecipheriv, scryptSync } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { OracleData } from "../data/oracle-types";
import type { LanguageDefinition, CanonicalTable } from "../languages/types";

// ── CLI argument parsing ───────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const langCode = getArg("lang");
const generateAll = args.includes("--all");
const password = getArg("password");
const usePlain = args.includes("--plain");

if (!langCode && !generateAll) {
  console.error("Usage: npx tsx scripts/generate-language.ts --lang <code> [--password <pw> | --plain]");
  console.error("       npx tsx scripts/generate-language.ts --all [--password <pw> | --plain]");
  process.exit(1);
}

if (!password && !usePlain) {
  console.error("Provide --password <pw> or --plain to use unencrypted oracle.json");
  process.exit(1);
}

/** Discover all language codes from languages/*.ts (excluding types.ts) */
function discoverLanguages(): string[] {
  const langDir = join(__dirname, "..", "languages");
  return readdirSync(langDir)
    .filter(f => f.endsWith(".ts") && f !== "types.ts")
    .map(f => f.replace(/\.ts$/, ""));
}

// ── Load oracle ────────────────────────────────────────────────
function decryptOracle(password: string): OracleData {
  const encPath = join(__dirname, "..", "data", "oracle.enc");
  const buf = readFileSync(encPath);
  const salt = buf.subarray(0, 32);
  const iv = buf.subarray(32, 48);
  const authTag = buf.subarray(48, 64);
  const encrypted = buf.subarray(64);

  const key = scryptSync(password, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf-8"));
}

function loadPlainOracle(): OracleData {
  const plainPath = join(__dirname, "..", "data", "oracle.json");
  return JSON.parse(readFileSync(plainPath, "utf-8"));
}

const oracle: OracleData = usePlain ? loadPlainOracle() : decryptOracle(password!);

// ── Load language definition ───────────────────────────────────
async function loadLanguage(code: string): Promise<LanguageDefinition> {
  const langPath = join(__dirname, "..", "languages", `${code}.ts`);
  if (!existsSync(langPath)) {
    console.error(`Language file not found: ${langPath}`);
    process.exit(1);
  }
  const mod = await import(langPath);
  return mod.default as LanguageDefinition;
}

// ── Person name construction ───────────────────────────────────
function getPersonName(lang: LanguageDefinition, personIndex: number): string {
  const person = oracle.persons[personIndex];
  return `${lang.firstNames[person.firstNameIndex]} ${lang.lastNames[person.lastNameIndex]}`;
}

function getPersonAddress(lang: LanguageDefinition, personIndex: number): string {
  const person = oracle.persons[personIndex];
  return `${lang.streets[person.streetIndex]} ${person.streetSuffix}`;
}

// ── SQL generation ─────────────────────────────────────────────
function generateCreateTableSQL(lang: LanguageDefinition): string {
  const t = lang.tables;
  const c = lang.columns;

  // We need to reproduce the exact same schema structure with translated names
  const statements: string[] = [];

  // Person
  statements.push(`CREATE TABLE ${t.Person} (${c.Person.id} TEXT NOT NULL, ${c.Person.name} TEXT NOT NULL, ${c.Person.address} TEXT NOT NULL, ${c.Person.postalCode} TEXT NOT NULL, ${c.Person.city} TEXT NOT NULL, ${c.Person.phone} TEXT NOT NULL, PRIMARY KEY (${c.Person.id}));`);

  // Room
  statements.push(`CREATE TABLE ${t.Room} (${c.Room.id} INTEGER NOT NULL, ${c.Room.name} TEXT NOT NULL, ${c.Room.capacity} INTEGER NOT NULL, PRIMARY KEY (${c.Room.id}));`);
  statements.push(`CREATE UNIQUE INDEX rum_namn ON ${t.Room} (${c.Room.name} ASC);`);

  // Student
  statements.push(`CREATE TABLE ${t.Student} (${c.Student.id} TEXT NOT NULL, ${c.Student.hasDisability} INTEGER NOT NULL, CONSTRAINT STUDENT_PK PRIMARY KEY (${c.Student.id}), CONSTRAINT Student_Person_FK FOREIGN KEY (${c.Student.id}) REFERENCES ${t.Person} (${c.Person.id}) ON DELETE RESTRICT ON UPDATE CASCADE);`);

  // Teacher
  statements.push(`CREATE TABLE ${t.Teacher} (${c.Teacher.id} TEXT NOT NULL, ${c.Teacher.officeRoom} INTEGER NOT NULL, CONSTRAINT LÄRARE_PK PRIMARY KEY (${c.Teacher.id}), CONSTRAINT FK_Lärare_Person FOREIGN KEY (${c.Teacher.id}) REFERENCES ${t.Person} (${c.Person.id}) ON DELETE RESTRICT ON UPDATE CASCADE);`);

  // Course
  statements.push(`CREATE TABLE ${t.Course} (${c.Course.code} TEXT NOT NULL, ${c.Course.name} TEXT NOT NULL, ${c.Course.duration} INTEGER NOT NULL, ${c.Course.price} INTEGER NOT NULL, ${c.Course.description} TEXT NOT NULL, PRIMARY KEY (${c.Course.code}));`);
  statements.push(`CREATE UNIQUE INDEX kurs_ben ON ${t.Course} (${c.Course.name} ASC);`);

  // CourseInstance
  statements.push(`CREATE TABLE ${t.CourseInstance} (${c.CourseInstance.course} TEXT NOT NULL, ${c.CourseInstance.startDate} TEXT NOT NULL, ${c.CourseInstance.teacher} TEXT NOT NULL, ${c.CourseInstance.room} INTEGER NOT NULL, CONSTRAINT KURSTILLFÄLLE_PK PRIMARY KEY (${c.CourseInstance.course}, ${c.CourseInstance.startDate}), CONSTRAINT FK_Kurstillfälle_Kurs FOREIGN KEY (${c.CourseInstance.course}) REFERENCES ${t.Course} (${c.Course.code}) ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT FK_Kurstillfälle_Lärare FOREIGN KEY (${c.CourseInstance.teacher}) REFERENCES ${t.Teacher} (${c.Teacher.id}) ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT FK_Kurstillfälle_Rum FOREIGN KEY (${c.CourseInstance.room}) REFERENCES ${t.Room} (${c.Room.id}) ON DELETE RESTRICT ON UPDATE CASCADE);`);

  // Participation
  statements.push(`CREATE TABLE ${t.Participation} (${c.Participation.student} TEXT NOT NULL, ${c.Participation.course} TEXT NOT NULL, ${c.Participation.startDate} TEXT NOT NULL, CONSTRAINT DELTAGANDE_PK PRIMARY KEY (${c.Participation.course}, ${c.Participation.startDate}, ${c.Participation.student}), CONSTRAINT FK_Deltagande_Kurstillfälle FOREIGN KEY (${c.Participation.course}, ${c.Participation.startDate}) REFERENCES ${t.CourseInstance} (${c.CourseInstance.course}, ${c.CourseInstance.startDate}) ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT FK_Deltagande_Student FOREIGN KEY (${c.Participation.student}) REFERENCES ${t.Student} (${c.Student.id}) ON DELETE RESTRICT ON UPDATE CASCADE);`);

  return statements.join("\n");
}

function generateInsertSQL(lang: LanguageDefinition): string {
  const t = lang.tables;
  const esc = (s: string) => s.replace(/'/g, "''");
  const statements: string[] = [];

  // Persons
  for (let i = 0; i < oracle.persons.length; i++) {
    const p = oracle.persons[i];
    const name = getPersonName(lang, i);
    const address = getPersonAddress(lang, i);
    statements.push(`INSERT INTO ${t.Person} VALUES ('${esc(lang.personIds[i])}', '${esc(name)}', '${esc(address)}', '${esc(lang.postalCodes[i])}', '${esc(lang.cities[p.cityIndex])}', '${esc(lang.phones[i])}');`);
  }

  // Rooms
  for (let i = 0; i < oracle.rooms.length; i++) {
    const r = oracle.rooms[i];
    statements.push(`INSERT INTO ${t.Room} VALUES (${r.id}, '${esc(lang.roomNames[i])}', ${r.capacity});`);
  }

  // Students
  for (let i = 0; i < oracle.persons.length; i++) {
    const p = oracle.persons[i];
    if (p.isStudent) {
      statements.push(`INSERT INTO ${t.Student} VALUES ('${esc(lang.personIds[i])}', ${p.disability});`);
    }
  }

  // Teachers
  for (let i = 0; i < oracle.persons.length; i++) {
    const p = oracle.persons[i];
    if (p.isTeacher) {
      statements.push(`INSERT INTO ${t.Teacher} VALUES ('${esc(lang.personIds[i])}', ${p.officeRoom});`);
    }
  }

  // Courses
  for (let i = 0; i < oracle.courses.length; i++) {
    const cr = oracle.courses[i];
    const key = cr.key as keyof typeof lang.courseCodes;
    statements.push(`INSERT INTO ${t.Course} VALUES ('${esc(lang.courseCodes[key])}', '${esc(lang.courseNames[key])}', ${cr.duration}, ${cr.price}, '${esc(lang.courseDescriptions[key])}');`);
  }

  // Course Instances
  for (const ci of oracle.courseInstances) {
    const courseKey = oracle.courses[ci.courseIndex].key as keyof typeof lang.courseCodes;
    const teacherId = lang.personIds[ci.teacherPersonIndex];
    statements.push(`INSERT INTO ${t.CourseInstance} VALUES ('${esc(lang.courseCodes[courseKey])}', '${esc(ci.startDate)}', '${esc(teacherId)}', ${oracle.rooms[ci.roomIndex].id});`);
  }

  // Participations
  for (const p of oracle.participations) {
    const courseKey = oracle.courses[p.courseIndex].key as keyof typeof lang.courseCodes;
    const studentId = lang.personIds[p.studentPersonIndex];
    statements.push(`INSERT INTO ${t.Participation} VALUES ('${esc(studentId)}', '${esc(lang.courseCodes[courseKey])}', '${esc(p.startDate)}');`);
  }

  return statements.join("\n");
}

// ── Query template resolution ──────────────────────────────────
function resolveQuery(template: string, lang: LanguageDefinition): string {
  return template.replace(/\{\{(\w+):([^}]+)\}\}/g, (_, type: string, ref: string) => {
    switch (type) {
      case "table":
        return lang.tables[ref as CanonicalTable];
      case "col": {
        const [table, col] = ref.split(".");
        const tableColumns = lang.columns[table as keyof typeof lang.columns];
        return (tableColumns as Record<string, string>)[col];
      }
      case "alias":
        return ref;
      case "city":
        return lang.cities[Number(ref)];
      case "courseCode": {
        const key = oracle.courses[Number(ref)].key as keyof typeof lang.courseCodes;
        return lang.courseCodes[key];
      }
      case "courseName": {
        const key = oracle.courses[Number(ref)].key as keyof typeof lang.courseNames;
        return lang.courseNames[key];
      }
      case "roomName":
        return lang.roomNames[Number(ref)];
      case "roomId":
        return String(oracle.rooms[Number(ref)].id);
      case "personName":
        return getPersonName(lang, Number(ref));
      case "personId":
        return lang.personIds[Number(ref)];
      default:
        console.warn(`Unknown placeholder type: ${type}`);
        return `{{${type}:${ref}}}`;
    }
  });
}

// ── Generate a single language ────────────────────────────────
type ResultData = { columns: string[]; values: (string | number | null)[][] };

async function generateForLanguage(code: string, SQL: any): Promise<boolean> {
  const lang = await loadLanguage(code);
  console.log(`Generating language data for: ${lang.displayName} (${lang.code})`);

  const db = new SQL.Database();

  // Create schema and insert data
  const createSQL = generateCreateTableSQL(lang);
  const insertSQL = generateInsertSQL(lang);

  db.run("PRAGMA foreign_keys = OFF;"); // OFF during bulk insert for performance
  for (const stmt of createSQL.split(";\n").filter(s => s.trim())) {
    db.run(stmt + ";");
  }
  for (const stmt of insertSQL.split(";\n").filter(s => s.trim())) {
    db.run(stmt + ";");
  }
  db.run("PRAGMA foreign_keys = ON;");

  // Register custom functions needed by some queries
  db.create_function("YEAR", (date: string) => new Date(date).getFullYear());
  db.create_function("MONTH", (date: string) => new Date(date).getMonth() + 1);
  db.create_function("DAY", (date: string) => new Date(date).getDate());

  // Build question pool by running reference queries
  const categoryMap = new Map<number, {
    category_id: number;
    display_number: number;
    questions: Array<{
      id: number;
      description: string;
      display_sequence: string;
      result: ResultData;
      alternative_results?: ResultData[];
    }>;
  }>();

  let errorCount = 0;

  function runQuery(queryTemplate: string): ResultData {
    const resolvedQuery = resolveQuery(queryTemplate, lang);
    const res = db.exec(resolvedQuery);
    if (res.length > 0) {
      // Replace expression column names (e.g. "COUNT(student)") with the language's aggregate label
      const columns = res[0].columns.map(col =>
        /[()]/.test(col) ? lang.aggregateLabel : col
      );
      return { columns, values: res[0].values as (string | number | null)[][] };
    }
    return { columns: [], values: [] };
  }

  for (const q of oracle.questions) {
    const description = lang.questionDescriptions[q.id];

    if (!description) {
      console.error(`Missing question description for Q${q.id} in language ${lang.code}`);
      errorCount++;
      continue;
    }

    let result: ResultData;
    try {
      result = runQuery(q.query);
    } catch (e) {
      console.error(`Error running query for Q${q.id}: ${(e as Error).message}`);
      console.error(`  Resolved query: ${resolveQuery(q.query, lang)}`);
      errorCount++;
      continue;
    }

    // Run alternative queries if present
    let alternative_results: ResultData[] | undefined;
    if (q.alternativeQueries && q.alternativeQueries.length > 0) {
      alternative_results = [];
      for (let i = 0; i < q.alternativeQueries.length; i++) {
        try {
          alternative_results.push(runQuery(q.alternativeQueries[i]));
        } catch (e) {
          console.error(`Error running alternative query ${i + 1} for Q${q.id}: ${(e as Error).message}`);
          console.error(`  Resolved query: ${resolveQuery(q.alternativeQueries[i], lang)}`);
          errorCount++;
        }
      }
      if (alternative_results.length === 0) {
        alternative_results = undefined;
      }
    }

    if (!categoryMap.has(q.categoryId)) {
      categoryMap.set(q.categoryId, {
        category_id: q.categoryId,
        display_number: q.displayNumber,
        questions: [],
      });
    }

    categoryMap.get(q.categoryId)!.questions.push({
      id: q.id,
      description,
      display_sequence: q.displaySequence,
      result,
      ...(alternative_results ? { alternative_results } : {}),
    });
  }

  if (errorCount > 0) {
    console.error(`\n${errorCount} error(s) occurred. Generated data may be incomplete.`);
  }

  // Sort categories and questions
  const categories = Array.from(categoryMap.values())
    .sort((a, b) => a.category_id - b.category_id);
  for (const cat of categories) {
    cat.questions.sort((a, b) => a.display_sequence.localeCompare(b.display_sequence));
  }

  // Write output
  const outputDir = join(__dirname, "..", "public", "languages", code);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Question pool JSON
  const questionPool = {
    language: lang.code,
    defaultQuery: `SELECT * FROM ${lang.tables.Student};`,
    questions: categories,
  };
  writeFileSync(
    join(outputDir, "questionpool.json"),
    JSON.stringify(questionPool),
    "utf-8"
  );
  console.log(`Wrote questionpool.json (${categories.length} categories, ${oracle.questions.length - errorCount} questions)`);

  // Database file
  const dbData = db.export();
  writeFileSync(join(outputDir, "data.sqlite3"), Buffer.from(dbData));
  console.log(`Wrote data.sqlite3 (${dbData.length} bytes)`);

  db.close();

  return errorCount === 0;
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  const initSqlJs = (await import("sql.js")).default;
  const SQL = await initSqlJs();

  const codes = generateAll ? discoverLanguages() : [langCode!];
  let allOk = true;

  for (const code of codes) {
    const ok = await generateForLanguage(code, SQL);
    if (!ok) allOk = false;
  }

  if (!allOk) {
    process.exit(1);
  }

  console.log("Done!");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
