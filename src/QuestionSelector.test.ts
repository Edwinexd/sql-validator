import { describe, expect, it } from "vitest";
import { getQuestion } from "./QuestionSelector";
import type { QuestionCategory } from "./i18n/context";

const questions: QuestionCategory[] = [{
  category_id: 2,
  display_number: 7,
  questions: [{
    id: 12,
    description: "Question",
    display_sequence: "A",
    result: { columns: ["id"], values: [[1]] },
    alternative_results: [{ columns: ["id"], values: [[2]] }],
  }],
}];

describe("getQuestion", () => {
  it("maps a language-pool question into an evaluable question", () => {
    expect(getQuestion(12, questions)).toMatchObject({
      id: 12,
      category: { id: 2, display_number: "7" },
      evaluable_result: { columns: ["id"], data: [[1]] },
      alternative_evaluable_results: [{ columns: ["id"], data: [[2]] }],
    });
  });

  it("returns undefined for an unknown id", () => {
    expect(getQuestion(99, questions)).toBeUndefined();
  });
});
