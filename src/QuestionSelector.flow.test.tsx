// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QuestionSelector from "./QuestionSelector";

const questions = [
  {
    category_id: 1,
    display_number: 1,
    questions: [
      { id: 1, description: "A", display_sequence: "A", result: { columns: ["id"], values: [[1]] } },
      { id: 2, description: "B", display_sequence: "B", result: { columns: ["id"], values: [[2]] } },
      { id: 3, description: "C", display_sequence: "C", result: { columns: ["id"], values: [[3]] } },
    ],
  },
  { category_id: 2, display_number: 2, questions: [{ id: 4, description: "D", display_sequence: "A", result: { columns: ["id"], values: [[4]] } }] },
];

vi.mock("./i18n/context", () => ({ useLanguage: () => ({ t: (key: string) => key, questions }) }));

afterEach(() => cleanup());

describe("QuestionSelector", () => {
  it("selects the first incomplete variant, then lets the user change it", async () => {
    const onSelect = vi.fn();
    render(<QuestionSelector onSelect={onSelect} writtenQuestions={[2, 3]} correctQuestions={[3]} />);
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(screen.getByRole("option", { name: "1" }));
    await waitFor(() => expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 2, display_sequence: "B" })));

    fireEvent.click(screen.getAllByRole("combobox")[1]);
    fireEvent.click(screen.getByRole("option", { name: "C" }));
    await waitFor(() => expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 3, display_sequence: "C" })));
  });

  it("reflects a question selected externally", () => {
    const onSelect = vi.fn();
    render(<QuestionSelector onSelect={onSelect} activeQuestion={{
      id: 4, description: "D", display_sequence: "A", result: { columns: ["id"], values: [[4]] },
      evaluable_result: { columns: ["id"], data: [[4]] }, category: { id: 2, display_number: "2" },
    }} />);
    expect(screen.getAllByRole("combobox")[0].textContent).toContain("2");
    expect(screen.getAllByRole("combobox")[1].textContent).toContain("A");
  });
});
