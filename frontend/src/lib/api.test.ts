import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiUrl, productionApiBaseUrl, resolveApiBaseUrl } from "./api";

describe("frontend API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves the current-user endpoint against the configured backend", () => {
    const configuredBaseUrl = resolveApiBaseUrl(import.meta.env.CATEGORY_API_URL);
    expect(apiUrl("/api/auth/me")).toBe(`${configuredBaseUrl}/api/auth/me`);
    expect(apiUrl("/api/auth/me")).not.toBe("/api/auth/me");
  });

  it("falls back to the Render backend when no frontend API URL is configured", () => {
    expect(resolveApiBaseUrl()).toBe(productionApiBaseUrl);
    expect(resolveApiBaseUrl("  ")).toBe(productionApiBaseUrl);
    expect(resolveApiBaseUrl(`${productionApiBaseUrl}/`)).toBe(productionApiBaseUrl);
  });

  it("keeps session credentials on current-user requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));

    await apiFetch("/api/auth/me");

    const configuredBaseUrl = resolveApiBaseUrl(import.meta.env.CATEGORY_API_URL);
    expect(fetchMock).toHaveBeenCalledWith(`${configuredBaseUrl}/api/auth/me`, {
      credentials: "include",
    });
  });
});
