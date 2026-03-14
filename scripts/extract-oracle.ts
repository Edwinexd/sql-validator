/**
 * Generates oracle.json from hardcoded canonical data and questions.json.
 *
 * Usage: npx tsx scripts/extract-oracle.ts
 *
 * Output: scripts/oracle.json
 */

import * as fs from "fs";
import * as path from "path";

import type {
  OraclePerson,
  OracleCourse,
  OracleRoom,
  OracleCourseInstance,
  OracleParticipation,
  OracleQuestion,
  OracleData,
} from "./oracle-types";

// ---------------------------------------------------------------------------
// 1. Persons (21 slots, in DB insertion order)
// ---------------------------------------------------------------------------

// personnummer -> slot index
const personSlots: Record<string, number> = {
  "111017-0001": 0,
  "111017-0002": 1,
  "111017-0003": 2,
  "111017-0004": 3,
  "111017-0005": 4,
  "121017-0001": 5,
  "121017-0002": 6,
  "121017-0003": 7,
  "121017-0004": 8,
  "121017-0005": 9,
  "121017-0006": 10,
  "121017-0007": 11,
  "121017-0008": 12,
  "121017-0009": 13,
  "121017-0010": 14,
  "121018-0040": 15,
  "121117-0041": 16,
  "131017-0050": 17,
  "131017-0051": 18,
  "131017-0052": 19,
  "131017-0053": 20,
};

// Student set: personnummer -> disability flag
const students: Record<string, number> = {
  "121017-0001": 0,
  "121017-0002": 1,
  "121017-0003": 0,
  "121017-0004": 0,
  "121017-0005": 0,
  "121017-0006": 1,
  "121017-0007": 0,
  "121017-0008": 0,
  "121017-0009": 0,
  "121017-0010": 1,
  "121018-0040": 0,
  "121117-0041": 1,
  "131017-0050": 0,
  "131017-0051": 0,
  "131017-0052": 1,
  "131017-0053": 0,
  "111017-0001": 0,
};

// Teacher set: personnummer -> office room number
const teachers: Record<string, number> = {
  "111017-0001": 634,
  "111017-0002": 604,
  "111017-0003": 603,
  "111017-0004": 605,
  "111017-0005": 622,
  "131017-0050": 558,
};

// Person-to-name mapping: [firstNameIndex, lastNameIndex]
const personNames: [number, number][] = [
  [0, 0],   // 0: Anders Ödman
  [1, 1],   // 1: Bo Åkerman
  [2, 2],   // 2: Carl Nordin
  [3, 3],   // 3: Lena Svensson
  [4, 4],   // 4: Sofia Wilsson
  [1, 5],   // 5: Bo Dahl
  [5, 6],   // 6: Ann Stål
  [6, 7],   // 7: Ebba Ryd
  [7, 8],   // 8: Robert Ahl
  [8, 9],   // 9: Lars Holm
  [9, 10],  // 10: Siw Björk
  [10, 11], // 11: Sigge Ehn
  [11, 12], // 12: Kurt Grahn
  [12, 13], // 13: Eva Jung
  [13, 14], // 14: Lola Frid
  [14, 15], // 15: Britt Maj
  [12, 16], // 16: Eva Berglund
  [2, 17],  // 17: Carl Nilsson
  [12, 13], // 18: Eva Jung (dup of 13)
  [8, 9],   // 19: Lars Holm (dup of 9)
  [1, 5],   // 20: Bo Dahl (dup of 5)
];

// Person-to-street mapping: [streetIndex, streetSuffix]
const personStreets: [number, string][] = [
  [0, "1"],    // 0: Centralvägen 1
  [1, "2"],    // 1: Villagatan 2
  [2, "3"],    // 2: Dalgatan 3
  [3, "4"],    // 3: Nygatan 4
  [4, "5"],    // 4: Björkgatan 5
  [5, "6"],    // 5: Ahlgatan 6
  [6, "3"],    // 6: Lindvägen 3
  [7, "4"],    // 7: Ankvägen 4
  [8, "1"],    // 8: Ekvägen 1
  [9, "3"],    // 9: Skolgatan 3
  [10, "2"],   // 10: Bokvägen 2
  [10, "24"],  // 11: Bokvägen 24
  [11, "112"], // 12: Byvägen 112
  [12, "5"],   // 13: Storgatan 5
  [13, "3"],   // 14: Lillgatan 3
  [14, "44"],  // 15: Karlvägen 44
  [15, "15b"], // 16: Hamngatan 15b
  [16, "4"],   // 17: Strogatan 4
  [9, "12"],   // 18: Skolgatan 12
  [9, "1"],    // 19: Skolgatan 1
  [3, "63"],   // 20: Nygatan 63
];

// Person-to-city mapping: cityIndex
const personCities: number[] = [
  0, // 0: Sollentuna
  1, // 1: Åkersberga
  2, // 2: Södertälje
  3, // 3: Täby
  2, // 4: Södertälje
  4, // 5: Bromma
  5, // 6: Kista
  4, // 7: Bromma
  5, // 8: Kista
  6, // 9: Solna
  5, // 10: Kista
  5, // 11: Kista
  7, // 12: Bro
  6, // 13: Solna
  3, // 14: Täby
  2, // 15: Södertälje
  2, // 16: Södertälje
  6, // 17: Solna
  6, // 18: Solna
  6, // 19: Solna
  3, // 20: Täby
];

const personnummerList = Object.keys(personSlots);

const persons: OraclePerson[] = personnummerList.map((pnr, i) => ({
  cityIndex: personCities[i],
  firstNameIndex: personNames[i][0],
  lastNameIndex: personNames[i][1],
  streetIndex: personStreets[i][0],
  streetSuffix: personStreets[i][1],
  isStudent: pnr in students,
  disability: students[pnr] ?? 0,
  isTeacher: pnr in teachers,
  officeRoom: teachers[pnr] ?? null,
}));

// ---------------------------------------------------------------------------
// 2. Courses (6 courses, canonical keys c1-c6)
// ---------------------------------------------------------------------------

const courses: OracleCourse[] = [
  { key: "c1", duration: 2, price: 2800 },  // DBM1
  { key: "c2", duration: 5, price: 7200 },  // FDBD
  { key: "c3", duration: 5, price: 6700 },  // Java1
  { key: "c4", duration: 4, price: 6000 },  // Java2
  { key: "c5", duration: 4, price: 6000 },  // LDBD
  { key: "c6", duration: 3, price: 4500 },  // Log1
];

// kurskod -> courseIndex
const courseMap: Record<string, number> = {
  DBM1: 0,
  FDBD: 1,
  Java1: 2,
  Java2: 3,
  LDBD: 4,
  Log1: 5,
};

// ---------------------------------------------------------------------------
// 3. Rooms (5 rooms)
// ---------------------------------------------------------------------------

const rooms: OracleRoom[] = [
  { id: 1, capacity: 12 },
  { id: 2, capacity: 24 },
  { id: 3, capacity: 16 },
  { id: 4, capacity: 32 },
  { id: 5, capacity: 24 },
];

// rum id -> roomIndex
const roomMap: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };

// ---------------------------------------------------------------------------
// 4. Course Instances (19 rows)
// ---------------------------------------------------------------------------

const rawInstances: [string, string, string, number][] = [
  ["Java1", "2008-03-06T00:00:00.000Z", "111017-0002", 4],
  ["DBM1", "2008-04-02T00:00:00.000Z", "111017-0005", 3],
  ["Java2", "2008-04-16T00:00:00.000Z", "111017-0002", 2],
  ["Log1", "2008-04-16T00:00:00.000Z", "111017-0003", 1],
  ["Java1", "2008-05-06T00:00:00.000Z", "111017-0002", 1],
  ["LDBD", "2008-05-06T00:00:00.000Z", "111017-0005", 3],
  ["FDBD", "2008-05-09T00:00:00.000Z", "111017-0004", 1],
  ["Java1", "2008-09-02T00:00:00.000Z", "111017-0003", 4],
  ["LDBD", "2008-09-02T00:00:00.000Z", "111017-0004", 2],
  ["Java2", "2009-01-22T00:00:00.000Z", "111017-0002", 2],
  ["DBM1", "2009-01-28T00:00:00.000Z", "111017-0005", 1],
  ["Log1", "2009-09-17T00:00:00.000Z", "111017-0005", 1],
  ["DBM1", "2010-02-15T00:00:00.000Z", "111017-0004", 3],
  ["Java2", "2010-04-11T00:00:00.000Z", "131017-0050", 4],
  ["Java1", "2010-05-01T00:00:00.000Z", "111017-0003", 5],
  ["Log1", "2010-05-01T00:00:00.000Z", "111017-0002", 1],
  ["DBM1", "2010-09-22T00:00:00.000Z", "131017-0050", 3],
  ["LDBD", "2010-09-24T00:00:00.000Z", "111017-0004", 5],
  ["Java1", "2011-05-01T00:00:00.000Z", "111017-0002", 5],
];

const courseInstances: OracleCourseInstance[] = rawInstances.map(
  ([kurs, startDate, larare, rum]) => ({
    courseIndex: courseMap[kurs],
    teacherPersonIndex: personSlots[larare],
    roomIndex: roomMap[rum],
    startDate,
  })
);

// ---------------------------------------------------------------------------
// 5. Participations (57 rows)
// ---------------------------------------------------------------------------

const rawParticipations: [string, string, string][] = [
  ["121017-0001", "Java1", "2008-03-06T00:00:00.000Z"],
  ["121017-0003", "Java1", "2008-03-06T00:00:00.000Z"],
  ["121017-0008", "Java1", "2008-03-06T00:00:00.000Z"],
  ["121017-0009", "Java1", "2008-03-06T00:00:00.000Z"],
  ["121017-0010", "Java1", "2008-03-06T00:00:00.000Z"],
  ["131017-0051", "Java1", "2008-03-06T00:00:00.000Z"],
  ["121017-0001", "DBM1", "2008-04-02T00:00:00.000Z"],
  ["121017-0002", "DBM1", "2008-04-02T00:00:00.000Z"],
  ["121017-0003", "DBM1", "2008-04-02T00:00:00.000Z"],
  ["121017-0010", "DBM1", "2008-04-02T00:00:00.000Z"],
  ["121017-0002", "Java2", "2008-04-16T00:00:00.000Z"],
  ["121017-0005", "Java2", "2008-04-16T00:00:00.000Z"],
  ["121017-0006", "Java2", "2008-04-16T00:00:00.000Z"],
  ["121017-0007", "Java2", "2008-04-16T00:00:00.000Z"],
  ["121017-0004", "Log1", "2008-04-16T00:00:00.000Z"],
  ["121017-0005", "Log1", "2008-04-16T00:00:00.000Z"],
  ["121017-0002", "Java1", "2008-05-06T00:00:00.000Z"],
  ["121017-0006", "Java1", "2008-05-06T00:00:00.000Z"],
  ["121017-0001", "LDBD", "2008-05-06T00:00:00.000Z"],
  ["121017-0007", "LDBD", "2008-05-06T00:00:00.000Z"],
  ["121017-0003", "FDBD", "2008-05-09T00:00:00.000Z"],
  ["121017-0006", "FDBD", "2008-05-09T00:00:00.000Z"],
  ["121017-0008", "FDBD", "2008-05-09T00:00:00.000Z"],
  ["121017-0001", "Java1", "2008-09-02T00:00:00.000Z"],
  ["121017-0009", "Java1", "2008-09-02T00:00:00.000Z"],
  ["121017-0006", "LDBD", "2008-09-02T00:00:00.000Z"],
  ["121017-0008", "LDBD", "2008-09-02T00:00:00.000Z"],
  ["131017-0050", "LDBD", "2008-09-02T00:00:00.000Z"],
  ["121017-0002", "Java2", "2009-01-22T00:00:00.000Z"],
  ["121017-0009", "Java2", "2009-01-22T00:00:00.000Z"],
  ["121017-0010", "Java2", "2009-01-22T00:00:00.000Z"],
  ["131017-0051", "Java2", "2009-01-22T00:00:00.000Z"],
  ["121017-0003", "DBM1", "2009-01-28T00:00:00.000Z"],
  ["121017-0005", "DBM1", "2009-01-28T00:00:00.000Z"],
  ["131017-0051", "DBM1", "2009-01-28T00:00:00.000Z"],
  ["121017-0004", "Log1", "2009-09-17T00:00:00.000Z"],
  ["121117-0041", "Log1", "2009-09-17T00:00:00.000Z"],
  ["121017-0003", "DBM1", "2010-02-15T00:00:00.000Z"],
  ["121017-0006", "DBM1", "2010-02-15T00:00:00.000Z"],
  ["121017-0010", "DBM1", "2010-02-15T00:00:00.000Z"],
  ["121017-0004", "Java2", "2010-04-11T00:00:00.000Z"],
  ["121017-0005", "Java2", "2010-04-11T00:00:00.000Z"],
  ["121017-0007", "Java2", "2010-04-11T00:00:00.000Z"],
  ["121017-0010", "Java2", "2010-04-11T00:00:00.000Z"],
  ["121017-0006", "Java1", "2010-05-01T00:00:00.000Z"],
  ["121017-0007", "Java1", "2010-05-01T00:00:00.000Z"],
  ["121017-0008", "Java1", "2010-05-01T00:00:00.000Z"],
  ["121017-0005", "Log1", "2010-05-01T00:00:00.000Z"],
  ["121017-0008", "Log1", "2010-05-01T00:00:00.000Z"],
  ["121018-0040", "Log1", "2010-05-01T00:00:00.000Z"],
  ["131017-0053", "Log1", "2010-05-01T00:00:00.000Z"],
  ["121017-0004", "DBM1", "2010-09-22T00:00:00.000Z"],
  ["121018-0040", "DBM1", "2010-09-22T00:00:00.000Z"],
  ["121117-0041", "DBM1", "2010-09-22T00:00:00.000Z"],
  ["131017-0052", "DBM1", "2010-09-22T00:00:00.000Z"],
  ["121017-0008", "LDBD", "2010-09-24T00:00:00.000Z"],
  ["121018-0040", "LDBD", "2010-09-24T00:00:00.000Z"],
  ["121117-0041", "LDBD", "2010-09-24T00:00:00.000Z"],
];

const participations: OracleParticipation[] = rawParticipations.map(
  ([student, kurs, startDate]) => ({
    studentPersonIndex: personSlots[student],
    courseIndex: courseMap[kurs],
    startDate,
  })
);

// ---------------------------------------------------------------------------
// 6. Questions (from questions.json)
// ---------------------------------------------------------------------------

interface QuestionCategory {
  category_id: number;
  display_number: number;
  questions: {
    id: number;
    display_sequence: string;
    description: string;
    result: unknown;
  }[];
}

const questionsPath = path.resolve(__dirname, "../src/questions.json");
const categories: QuestionCategory[] = JSON.parse(
  fs.readFileSync(questionsPath, "utf-8")
);

const questions: OracleQuestion[] = [];
for (const cat of categories) {
  for (const q of cat.questions) {
    questions.push({
      id: q.id,
      categoryId: cat.category_id,
      displayNumber: cat.display_number,
      displaySequence: q.display_sequence,
      query: "",
    });
  }
}

// ---------------------------------------------------------------------------
// 7. Assemble and write
// ---------------------------------------------------------------------------

const oracle: OracleData = {
  persons,
  courses,
  rooms,
  courseInstances,
  participations,
  questions,
};

const outPath = path.resolve(__dirname, "oracle.json");
fs.writeFileSync(outPath, JSON.stringify(oracle, null, 2) + "\n");

console.log(`Wrote ${outPath}`);
console.log(`  ${persons.length} persons`);
console.log(`  ${courses.length} courses`);
console.log(`  ${rooms.length} rooms`);
console.log(`  ${courseInstances.length} course instances`);
console.log(`  ${participations.length} participations`);
console.log(`  ${questions.length} questions`);
