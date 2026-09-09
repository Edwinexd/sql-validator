// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const bootstrap = vi.hoisted(() => ({ render: vi.fn(), createRoot: vi.fn(), report: vi.fn() }));

vi.mock("react-dom/client", () => ({ default: { createRoot: bootstrap.createRoot } }));
vi.mock("./App", () => ({ default: () => null }));
vi.mock("./i18n/context", () => ({ LanguageProvider: ({ children }: { children: unknown }) => children }));
vi.mock("./reportWebVitals", () => ({ default: bootstrap.report }));

describe("browser bootstrap", () => {
  beforeEach(() => {
    bootstrap.render.mockClear();
    bootstrap.createRoot.mockClear();
    bootstrap.report.mockClear();
    bootstrap.createRoot.mockReturnValue({ render: bootstrap.render });
    document.body.innerHTML = '<div id="root"></div>';
    vi.resetModules();
  });

  it("mounts the application inside its root and starts performance reporting", async () => {
    await import("./index");
    expect(bootstrap.createRoot).toHaveBeenCalledWith(document.getElementById("root"));
    expect(bootstrap.render).toHaveBeenCalledTimes(1);
    expect(bootstrap.report).toHaveBeenCalledTimes(1);
  });
});
