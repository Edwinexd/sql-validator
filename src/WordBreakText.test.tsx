// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import WordBreakText from "./WordBreakText";

afterEach(() => cleanup());

describe("WordBreakText", () => {
  it("inserts breaks at camel, acronym, number, underscore, and hyphen boundaries", () => {
    const { container } = render(<WordBreakText text="XMLHttp2Request_name-value" />);

    expect(container.querySelectorAll("wbr").length).toBeGreaterThan(0);
    expect(container.textContent).toBe("XMLHttp2Request_name-value");
    expect(container.querySelector("span")?.lastChild?.nodeName).not.toBe("WBR");
  });

  it("does not add a trailing word break", () => {
    const { container } = render(<WordBreakText text="plain" />);
    expect(container.querySelectorAll("wbr")).toHaveLength(0);
  });
});
