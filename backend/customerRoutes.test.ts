import { once } from "node:events";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addresses: new Map<string, Array<Record<string, unknown>>>(),
  profiles: new Map<string, Record<string, unknown>>(),
  wishlists: new Map<string, string[]>(),
  getSessionCustomer: vi.fn(),
  listCustomerAddresses: vi.fn(),
  addCustomerAddress: vi.fn(),
  updateCustomerAddress: vi.fn(),
  deleteCustomerAddress: vi.fn(),
  getCustomerWishlist: vi.fn(),
  addCustomerWishlistItem: vi.fn(),
  removeCustomerWishlistItem: vi.fn(),
  mergeCustomerWishlist: vi.fn(),
  getCustomerProfile: vi.fn(),
  updateCustomerProfile: vi.fn(),
  getProduct: vi.fn(),
  listCustomerOrders: vi.fn(),
}));

vi.mock("./authService.js", () => ({
  getSessionCustomer: mocks.getSessionCustomer,
}));
vi.mock("./customerDataStore.js", () => ({
  listCustomerAddresses: mocks.listCustomerAddresses,
  addCustomerAddress: mocks.addCustomerAddress,
  updateCustomerAddress: mocks.updateCustomerAddress,
  deleteCustomerAddress: mocks.deleteCustomerAddress,
  getCustomerWishlist: mocks.getCustomerWishlist,
  addCustomerWishlistItem: mocks.addCustomerWishlistItem,
  removeCustomerWishlistItem: mocks.removeCustomerWishlistItem,
  mergeCustomerWishlist: mocks.mergeCustomerWishlist,
  getCustomerProfile: mocks.getCustomerProfile,
  updateCustomerProfile: mocks.updateCustomerProfile,
}));
vi.mock("./productStore.js", () => ({ getProduct: mocks.getProduct }));
vi.mock("./orderStore.js", () => ({ listCustomerOrders: mocks.listCustomerOrders }));

import { createCustomerRouter } from "./customerRoutes.js";

let server: ReturnType<express.Application["listen"]>;
let baseUrl = "";

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.addresses.clear();
  mocks.wishlists.clear();
  mocks.profiles.clear();
  mocks.getSessionCustomer.mockImplementation(async (request: { headers: { cookie?: string } }) => {
    const id = request.headers.cookie?.includes("customer-b") ? "customer-b" : request.headers.cookie?.includes("customer-a") ? "customer-a" : "";
    return id ? { _id: { toString: () => id }, name: `Name ${id}`, email: `${id}@example.com`, mobile: "9876543210" } : null;
  });
  mocks.getCustomerProfile.mockImplementation(async (userId: string, identity: Record<string, string>) => ({
    userId,
    name: "Name customer-a",
    ...identity,
    ...mocks.profiles.get(userId),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  }));
  mocks.updateCustomerProfile.mockImplementation(async (userId: string, email: string, patch: Record<string, unknown>) => {
    const profile = { ...(mocks.profiles.get(userId) || {}), ...patch, email };
    if (patch.photo === null) delete profile.photo;
    mocks.profiles.set(userId, profile);
    return {
      userId,
      name: "Name customer-a",
      ...profile,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
  });
  mocks.listCustomerAddresses.mockImplementation(async (userId: string) => mocks.addresses.get(userId) || []);
  mocks.addCustomerAddress.mockImplementation(async (userId: string, address: Record<string, unknown>) => {
    const saved = mocks.addresses.get(userId) || [];
    const existing = saved.find((entry) => entry.id === address.id);
    if (existing) return existing;
    saved.push(address);
    mocks.addresses.set(userId, saved);
    return address;
  });
  mocks.updateCustomerAddress.mockImplementation(async (userId: string, id: string, patch: Record<string, unknown>) => {
    const entry = mocks.addresses.get(userId)?.find((address) => address.id === id);
    if (!entry) return null;
    Object.assign(entry, patch);
    return entry;
  });
  mocks.deleteCustomerAddress.mockImplementation(async (userId: string, id: string) => {
    const saved = mocks.addresses.get(userId) || [];
    const remaining = saved.filter((entry) => entry.id !== id);
    mocks.addresses.set(userId, remaining);
    return remaining.length !== saved.length;
  });
  mocks.getCustomerWishlist.mockImplementation(async (userId: string) => mocks.wishlists.get(userId) || []);
  mocks.addCustomerWishlistItem.mockImplementation(async (userId: string, id: string) => {
    const list = Array.from(new Set([...(mocks.wishlists.get(userId) || []), id]));
    mocks.wishlists.set(userId, list);
    return list;
  });
  mocks.removeCustomerWishlistItem.mockImplementation(async (userId: string, id: string) => {
    const list = (mocks.wishlists.get(userId) || []).filter((entry) => entry !== id);
    mocks.wishlists.set(userId, list);
    return list;
  });
  mocks.mergeCustomerWishlist.mockImplementation(async (userId: string, ids: string[]) => {
    const list = Array.from(new Set([...(mocks.wishlists.get(userId) || []), ...ids]));
    mocks.wishlists.set(userId, list);
    return list;
  });
  mocks.getProduct.mockImplementation(async (id: string) => id === "shirt-1" ? { id } : null);
  mocks.listCustomerOrders.mockImplementation(async (userId: string, page: number, limit: number) => ({
    orders: [{ id: `${userId}-order` }],
    total: 1,
    page,
    limit,
  }));

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(createCustomerRouter());
  server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

const addressInput = {
  fullName: "Test Customer",
  phone: "9876543210",
  address: "10 Test Street",
  city: "Chennai",
  state: "Tamil Nadu",
  pinCode: "600001",
};
const validPng = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64")}`;

const asCustomer = (id: "customer-a" | "customer-b") => ({ cookie: `customer=${id}` });

describe("customer account routes", () => {
  it("loads and updates only the authenticated customer's profile and keeps account email authoritative", async () => {
    const loaded = await fetch(`${baseUrl}/api/customer/profile`, { headers: asCustomer("customer-a") });
    expect(loaded.status).toBe(200);
    expect(await loaded.json()).toMatchObject({ profile: { name: "Name customer-a", email: "customer-a@example.com" } });
    expect(mocks.getCustomerProfile).toHaveBeenCalledWith("customer-a", {
      name: "Name customer-a",
      email: "customer-a@example.com",
      phone: "9876543210",
    });

    const updated = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: { ...asCustomer("customer-a"), "content-type": "application/json" },
      body: JSON.stringify({
        userId: "customer-b",
        name: "Updated Customer",
        phone: "9876543211",
        email: "attacker@example.com",
        photo: validPng,
      }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      profile: { name: "Updated Customer", email: "customer-a@example.com", phone: "9876543211" },
    });
    expect(mocks.updateCustomerProfile).toHaveBeenCalledWith("customer-a", "customer-a@example.com", {
      name: "Updated Customer",
      phone: "9876543211",
      photo: validPng,
    });
  });

  it("requires authentication and validates profile fields", async () => {
    const unauthorized = await fetch(`${baseUrl}/api/customer/profile`);
    expect(unauthorized.status).toBe(401);
    const invalid = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: { ...asCustomer("customer-a"), "content-type": "application/json" },
      body: JSON.stringify({ name: "  ", phone: "not a number", photo: "javascript:alert(1)" }),
    });
    expect(invalid.status).toBe(400);
    expect(mocks.updateCustomerProfile).not.toHaveBeenCalled();
  });

  it("stores a supported profile image and returns the exact value again after profile reload", async () => {
    const saved = await fetch(`${baseUrl}/api/customer/profile`, {
      method: "PATCH",
      headers: { ...asCustomer("customer-a"), "content-type": "application/json" },
      body: JSON.stringify({ name: "Customer A", phone: "9876543210", photo: validPng }),
    });
    expect(saved.status).toBe(200);
    expect((await saved.json()).profile.photo).toBe(validPng);

    const reloaded = await fetch(`${baseUrl}/api/customer/profile`, { headers: asCustomer("customer-a") });
    expect(reloaded.status).toBe(200);
    expect((await reloaded.json()).profile.photo).toBe(validPng);
    expect(mocks.profiles.get("customer-a")?.photo).toBe(validPng);
  });

  it("rejects malformed, oversized, and non-image data URLs without updating the profile", async () => {
    for (const photo of [
      "data:image/png;base64,aGVsbG8=",
      "data:image/jpeg;base64,AA==",
      `data:image/png;base64,${Buffer.alloc(4_000_001, 1).toString("base64")}`,
      "blob:https://tribull.shop/temporary",
    ]) {
      const invalid = await fetch(`${baseUrl}/api/customer/profile`, {
        method: "PATCH",
        headers: { ...asCustomer("customer-a"), "content-type": "application/json" },
        body: JSON.stringify({ name: "Customer A", phone: "9876543210", photo }),
      });
      expect(invalid.status).toBe(400);
    }
    expect(mocks.updateCustomerProfile).not.toHaveBeenCalled();
  });

  it("persists addresses for the authenticated customer and isolates the next login", async () => {
    const saved = await fetch(`${baseUrl}/api/customer/addresses`, {
      method: "POST",
      headers: { ...asCustomer("customer-a"), "content-type": "application/json" },
      body: JSON.stringify({ ...addressInput, requestId: "request-key-for-address-001" }),
    });
    expect(saved.status).toBe(201);
    const entry = await saved.json() as { id: string };
    const retried = await fetch(`${baseUrl}/api/customer/addresses`, {
      method: "POST",
      headers: { ...asCustomer("customer-a"), "content-type": "application/json" },
      body: JSON.stringify({ ...addressInput, requestId: "request-key-for-address-001" }),
    });
    expect(await retried.json()).toMatchObject({ id: entry.id });
    expect(mocks.addresses.get("customer-a")).toHaveLength(1);

    const afterReload = await fetch(`${baseUrl}/api/customer/addresses`, { headers: asCustomer("customer-a") });
    expect(await afterReload.json()).toEqual([expect.objectContaining({ id: entry.id, fullName: "Test Customer" })]);
    const otherCustomer = await fetch(`${baseUrl}/api/customer/addresses`, { headers: asCustomer("customer-b") });
    expect(await otherCustomer.json()).toEqual([]);
    expect(mocks.addCustomerAddress).toHaveBeenCalledWith("customer-a", expect.objectContaining({ id: "request-key-for-address-001" }));
  });

  it("normalizes lowercase city/state and accepts a missing optional apartment", async () => {
    const saved = await fetch(`${baseUrl}/api/customer/addresses`, {
      method: "POST",
      headers: { ...asCustomer("customer-a"), "content-type": "application/json" },
      body: JSON.stringify({
        ...addressInput,
        city: "  chennai   south ",
        state: "  tAmIl    nAdU ",
        requestId: "request-key-lowercase-001",
      }),
    });

    expect(saved.status).toBe(201);
    expect(await saved.json()).toMatchObject({
      city: "chennai south",
      state: "Tamil Nadu",
      apartment: "",
    });
    expect(mocks.addCustomerAddress).toHaveBeenCalledWith(
      "customer-a",
      expect.objectContaining({ city: "chennai south", state: "Tamil Nadu", apartment: "" }),
    );
  });

  it("reports an address persistence failure without returning a success response", async () => {
    mocks.addCustomerAddress.mockRejectedValueOnce(new Error("Mongo write failed"));
    const failed = await fetch(`${baseUrl}/api/customer/addresses`, {
      method: "POST",
      headers: { ...asCustomer("customer-a"), "content-type": "application/json" },
      body: JSON.stringify({ ...addressInput, requestId: "request-key-failure-001" }),
    });

    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "Unable to save this address" });
  });

  it("rejects invalid addresses and confirms delete after a valid save", async () => {
    const invalid = await fetch(`${baseUrl}/api/customer/addresses`, {
      method: "POST",
      headers: { ...asCustomer("customer-a"), "content-type": "application/json" },
      body: JSON.stringify({ ...addressInput, pinCode: "123" , requestId: "request-key-for-address-002" }),
    });
    expect(invalid.status).toBe(400);
    expect(mocks.addCustomerAddress).not.toHaveBeenCalled();

    mocks.addresses.set("customer-a", [{ id: "address-one" }]);
    const removed = await fetch(`${baseUrl}/api/customer/addresses/address-one`, {
      method: "DELETE",
      headers: asCustomer("customer-a"),
    });
    expect(removed.status).toBe(204);
    expect(mocks.deleteCustomerAddress).toHaveBeenCalledWith("customer-a", "address-one");
  });

  it("edits only an address owned by the authenticated customer", async () => {
    mocks.addresses.set("customer-a", [{ id: "address-one", ...addressInput }]);
    const edited = await fetch(`${baseUrl}/api/customer/addresses/address-one`, {
      method: "PATCH",
      headers: { ...asCustomer("customer-a"), "content-type": "application/json" },
      body: JSON.stringify({ ...addressInput, city: "Pune", isDefault: true }),
    });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ id: "address-one", city: "Pune" });
    const refreshed = await fetch(`${baseUrl}/api/customer/addresses`, { headers: asCustomer("customer-a") });
    expect(await refreshed.json()).toEqual([expect.objectContaining({ id: "address-one", city: "Pune" })]);

    const otherCustomer = await fetch(`${baseUrl}/api/customer/addresses/address-one`, {
      method: "PATCH",
      headers: { ...asCustomer("customer-b"), "content-type": "application/json" },
      body: JSON.stringify({ ...addressInput, city: "Pune" }),
    });
    expect(otherCustomer.status).toBe(404);
    expect(mocks.updateCustomerAddress).toHaveBeenCalledWith("customer-a", "address-one", expect.objectContaining({ city: "Pune" }));
  });

  it("validates catalog products and stores wishlist changes only for the signed-in customer", async () => {
    const added = await fetch(`${baseUrl}/api/customer/wishlist/shirt-1`, {
      method: "PUT",
      headers: asCustomer("customer-a"),
    });
    expect((await added.json()).productIds).toEqual(["shirt-1"]);

    await fetch(`${baseUrl}/api/customer/wishlist/shirt-1`, { method: "PUT", headers: asCustomer("customer-a") });
    expect(mocks.wishlists.get("customer-a")).toEqual(["shirt-1"]);
    const denied = await fetch(`${baseUrl}/api/customer/wishlist/unknown-product`, {
      method: "PUT",
      headers: asCustomer("customer-a"),
    });
    expect(denied.status).toBe(404);
    const removed = await fetch(`${baseUrl}/api/customer/wishlist/shirt-1`, {
      method: "DELETE",
      headers: asCustomer("customer-a"),
    });
    expect((await removed.json()).productIds).toEqual([]);
    const otherCustomer = await fetch(`${baseUrl}/api/customer/wishlist`, { headers: asCustomer("customer-b") });
    expect((await otherCustomer.json()).productIds).toEqual([]);
  });

  it("returns paginated order history using only the authenticated user ID", async () => {
    const response = await fetch(`${baseUrl}/api/customer/orders?page=2`, { headers: asCustomer("customer-b") });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      orders: [{ id: "customer-b-order" }],
      page: 2,
      limit: 20,
    });
    expect(mocks.listCustomerOrders).toHaveBeenCalledWith("customer-b", 2, 20);
  });

  it("returns each authenticated customer's own order and excludes the other customer's order", async () => {
    const customerAResponse = await fetch(`${baseUrl}/api/customer/orders?page=1`, {
      headers: asCustomer("customer-a"),
    });
    const customerBResponse = await fetch(`${baseUrl}/api/customer/orders?page=1`, {
      headers: asCustomer("customer-b"),
    });
    const customerAOrders = await customerAResponse.json() as { orders: Array<{ id: string }> };
    const customerBOrders = await customerBResponse.json() as { orders: Array<{ id: string }> };

    expect(customerAOrders.orders.map((order) => order.id)).toEqual(["customer-a-order"]);
    expect(customerBOrders.orders.map((order) => order.id)).toEqual(["customer-b-order"]);
    expect(customerAOrders.orders.some((order) => order.id === "customer-b-order")).toBe(false);
    expect(customerBOrders.orders.some((order) => order.id === "customer-a-order")).toBe(false);
    expect(mocks.listCustomerOrders).toHaveBeenNthCalledWith(1, "customer-a", 1, 20);
    expect(mocks.listCustomerOrders).toHaveBeenNthCalledWith(2, "customer-b", 1, 20);
  });

  it("requires authentication for every account resource", async () => {
    const response = await fetch(`${baseUrl}/api/customer/addresses`);
    expect(response.status).toBe(401);
  });
});
