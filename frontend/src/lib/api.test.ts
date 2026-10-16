import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiUrl, productionApiBaseUrl, resolveApiBaseUrl } from "./api";

describe("frontend API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("resolves the current-user endpoint against the configured backend", () => {
    const configuredBaseUrl = resolveApiBaseUrl(import.meta.env.CATEGORY_API_URL);
    expect(apiUrl("/api/auth/me")).toBe(`${configuredBaseUrl}/api/auth/me`);
    expect(apiUrl("/api/auth/me")).not.toBe("/api/auth/me");
  });

  it("uses the same-origin API path in the browser for the Vercel proxy", () => {
    vi.stubGlobal("window", { location: { hostname: "www.tribull.shop" } });
    expect(apiUrl("/api/auth/me")).toBe("/api/auth/me");
  });

  it("falls back to the Render backend when no frontend API URL is configured", () => {
    expect(resolveApiBaseUrl()).toBe(productionApiBaseUrl);
    expect(resolveApiBaseUrl("  ")).toBe(productionApiBaseUrl);
    expect(resolveApiBaseUrl(`${productionApiBaseUrl}/`)).toBe(productionApiBaseUrl);
  });

  it("keeps session credentials on current-user requests", async () => {
    vi.stubGlobal("window", { location: { hostname: "www.tribull.shop" } });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));

    await apiFetch("/api/auth/me");

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", {
      credentials: "include",
    });
  });
});
