import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("./api", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("sonner", () => ({ toast: { info: mocks.info, error: mocks.error } }));

const values = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  values.clear();
  vi.stubGlobal("window", {
    localStorage: localStorageMock,
    dispatchEvent: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("customer wishlist synchronization", () => {
  it("loads the authenticated wishlist instead of merging stale browser state", async () => {
    values.set("tribull-wishlist", JSON.stringify(["former-customer-item"]));
    mocks.apiFetch.mockResolvedValue(new Response(JSON.stringify({ productIds: ["account-item"] }), { status: 200 }));
    const { syncCustomerWishlist } = await import("./wishlist");

    await expect(syncCustomerWishlist()).resolves.toEqual(["account-item"]);

    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/customer/wishlist", { cache: "no-store" });
    expect(JSON.parse(values.get("tribull-wishlist") || "[]")).toEqual(["account-item"]);
  });

  it("merges only explicit guest items once and deduplicates them", async () => {
    values.set("tribull-wishlist", JSON.stringify(["stale-item"]));
    values.set("tribull-guest-wishlist", JSON.stringify(["guest-item", "guest-item"]));
    mocks.apiFetch.mockResolvedValue(new Response(JSON.stringify({ productIds: ["saved-item", "guest-item"] }), { status: 200 }));
    const { syncCustomerWishlist } = await import("./wishlist");

    await expect(syncCustomerWishlist()).resolves.toEqual(["saved-item", "guest-item"]);

    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/customer/wishlist/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: ["guest-item"] }),
    });
    expect(values.has("tribull-guest-wishlist")).toBe(false);
    expect(JSON.parse(values.get("tribull-wishlist") || "[]")).toEqual(["saved-item", "guest-item"]);
  });

  it("does not turn a prior account wishlist into guest data after authentication expires", async () => {
    values.set("tribull-wishlist", JSON.stringify(["former-customer-item"]));
    const { preserveGuestWishlist } = await import("./wishlist");

    preserveGuestWishlist();

    expect(JSON.parse(values.get("tribull-guest-wishlist") || "[]")).toEqual([]);
    expect(JSON.parse(values.get("tribull-wishlist") || "[]")).toEqual([]);
  });
});
