// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubEnv("VITE_PRIVACY_CF_WEB_ANALYTICS", "true");
  vi.stubEnv("VITE_PRIVACY_COMPANY_NAME", "Example University");
  vi.stubEnv("VITE_PRIVACY_COMPANY_PARENTHESES_VALUE", "EU");
  vi.stubEnv("VITE_PRIVACY_EMAIL", "privacy@example.test");
});

afterEach(() => cleanup());

describe("PrivacyNoticeToggle when analytics is enabled", () => {
  it("opens and closes its deployment-specific notice", async () => {
    const { default: PrivacyNoticeToggle } = await import("./PrivacyNoticeToggle");
    render(<PrivacyNoticeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Privacy Notice" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText((_content, element) => element?.tagName === "P" && element.textContent?.includes("Example University") === true)).toBeTruthy();
    expect(screen.getByRole("link", { name: "privacy@example.test" }).getAttribute("href")).toBe("mailto:privacy@example.test");
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
