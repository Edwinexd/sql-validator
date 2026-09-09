import { describe, expect, it, vi } from "vitest";

const metrics = vi.hoisted(() => ({
  getCLS: vi.fn(), getFID: vi.fn(), getFCP: vi.fn(), getLCP: vi.fn(), getTTFB: vi.fn(),
}));

vi.mock("web-vitals", () => metrics);

import reportWebVitals from "./reportWebVitals";

describe("reportWebVitals", () => {
  it("does nothing without a callback", () => {
    reportWebVitals();
    expect(metrics.getCLS).not.toHaveBeenCalled();
  });

  it("registers every metric when given a callback", async () => {
    const handler = vi.fn();
    reportWebVitals(handler);
    await vi.waitFor(() => expect(metrics.getTTFB).toHaveBeenCalledWith(handler));
    expect(metrics.getCLS).toHaveBeenCalledWith(handler);
    expect(metrics.getFID).toHaveBeenCalledWith(handler);
    expect(metrics.getFCP).toHaveBeenCalledWith(handler);
    expect(metrics.getLCP).toHaveBeenCalledWith(handler);
  });
});
