// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RAPreview, { renderRAPreview } from "./RAPreview";

describe("renderRAPreview", () => {
  it("renders operators, subscripts, literals, comments, and punctuation in CSS mode", () => {
    const html = renderRAPreview(
      "-- note\nσ_{age >= 20 and name = 'Ada'}(Person) ⋈[Person.id = Student.id] Student |X| Teacher |><| Course A <- π[name](Person) -> Result"
    );

    expect(html).toContain('class="ra-prev-comment"');
    expect(html).toContain("<br/>");
    expect(html).toContain('class="ra-prev-op">σ');
    expect(html).toContain('class="ra-prev-sub"');
    expect(html).toContain('class="ra-prev-logic">&gt;=');
    expect(html).toContain("class=\"ra-prev-str\">'Ada'");
    expect(html).toContain('class="ra-prev-assign">←');
    expect(html).toContain("⋈");
    expect(html).toContain("→");
  });

  it("supports bracket, implicit, and binary keyword subscripts", () => {
    const html = renderRAPreview("pi[name] Person sigma age > 20 Person join {Person.id = Student.id} Student");

    expect(html.match(/ra-prev-sub/g)).toHaveLength(3);
    expect(html).toContain("name");
    expect(html).toContain("age");
    expect(html).toContain("Person.id");
  });

  it("keeps operators without a following subscript and unterminated strings renderable", () => {
    const html = renderRAPreview("σ Person R ⋈ S 'unfinished");

    expect(html).toContain("Person");
    expect(html).toContain("R");
    expect(html).toContain("'unfinished");
  });

  it("keeps non-logic identifiers as plain text", () => {
    expect(renderRAPreview("Person")).toBe("Person");
  });

  it("does not invent a subscript before an operand and styles top-level logic", () => {
    const html = renderRAPreview("σ (Person) and");
    expect(html).toContain("Person");
    expect(html).toContain('class="ra-prev-logic">and');
  });

  it("handles raw binary operators, parenthesis, comparison tokens, numbers, and escaped characters", () => {
    const html = renderRAPreview("R ∪ S ∩ T − U × V ÷ W ⟕ X ⋉ Y ⋊ Z ▷ Q (a <> 1.5 != b) & < > ! =");

    expect(html).toContain('class="ra-prev-paren"');
    expect(html).toContain('class="ra-prev-num">1.5');
    expect(html).toContain('class="ra-prev-logic"');
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
  });

  it("uses inline styles for export", () => {
    const html = renderRAPreview("ρ[name→fullName](Person)", true);

    expect(html).toContain("color: #7c3aed");
    expect(html).toContain("font-size: 0.9em");
  });
});

describe("RAPreview component", () => {
  it("does not render empty or comment-only input", () => {
    const { rerender, container } = render(<RAPreview code="  " />);
    expect(container.innerHTML).toBe("");

    rerender(<RAPreview code="-- note" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a preview for an expression", () => {
    render(<RAPreview code="π[name](Person)" />);
    expect(screen.getByText("π")).toBeTruthy();
    expect(screen.getByText("Person")).toBeTruthy();
  });
});
