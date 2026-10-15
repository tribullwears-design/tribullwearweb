import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { getSessionCustomer } from "./authService.js";
import { authorizeAdmin, requireAdmin, requireAdminPermission } from "./adminAuth.js";
import { fullAdminPermissions } from "./adminPermissions.js";

vi.mock("./authService.js", () => ({ getSessionCustomer: vi.fn() }));

const sessionLookup = vi.mocked(getSessionCustomer);

function responseMock() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  vi.mocked(response.status).mockReturnValue(response);
  return response;
}

async function settleMiddleware() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  sessionLookup.mockReset();
});

describe("authorizeAdmin", () => {
  it("requires an authenticated session and an explicitly provisioned admin role", () => {
    expect(authorizeAdmin(false, "admin")).toEqual({
      allowed: false,
      status: 401,
      error: "Sign in with an authorized admin account",
    });
    expect(authorizeAdmin(true, undefined)).toEqual({
      allowed: false,
      status: 403,
      error: "Admin access is required",
    });
    expect(authorizeAdmin(true, "admin")).toEqual({ allowed: true });
  });

  it("returns 401 when a request has no authenticated customer session", async () => {
    sessionLookup.mockResolvedValue(null);
    const response = responseMock();
    const next = vi.fn();

    requireAdmin({} as Request, response, next);
    await settleMiddleware();

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "Sign in with an authorized admin account" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when the authenticated customer is not an admin", async () => {
    sessionLookup.mockResolvedValue({
      name: "Customer",
      email: "customer@example.com",
      mobile: "",
      authProviders: ["password"],
      isProfileComplete: true,
      tokenVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const response = responseMock();
    const next = vi.fn();

    requireAdmin({} as Request, response, next);
    await settleMiddleware();

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "Admin access is required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("continues only for an authenticated customer with the admin role", async () => {
    sessionLookup.mockResolvedValue({
      name: "Admin",
      email: "admin@example.com",
      mobile: "",
      authProviders: ["password"],
      isProfileComplete: true,
      tokenVersion: 1,
      adminRole: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const response = responseMock();
    const next = vi.fn();

    requireAdmin({} as Request, response, next);
    await settleMiddleware();

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("rejects inactive admin accounts and missing section permissions", () => {
    expect(authorizeAdmin(true, "admin", "Inactive")).toEqual({
      allowed: false,
      status: 403,
      error: "This admin account is inactive",
    });
    expect(authorizeAdmin(true, "admin", "Active", {
      ...fullAdminPermissions,
      orders: { view: false, edit: false },
    }, { section: "orders", action: "view" })).toEqual({
      allowed: false,
      status: 403,
      error: "You do not have permission to perform this action",
    });
    expect(authorizeAdmin(true, "admin", "Active", undefined, { section: "orders", action: "edit" }))
      .toEqual({ allowed: true });
  });

  it("allows legacy admins and enforces persisted edit permissions in middleware", async () => {
    sessionLookup.mockResolvedValue({
      name: "Admin",
      email: "admin@example.com",
      mobile: "",
      authProviders: ["password"],
      isProfileComplete: true,
      tokenVersion: 1,
      adminRole: "admin",
      adminPermissions: {
        ...fullAdminPermissions,
        products: { view: true, edit: false },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const response = responseMock();
    const next = vi.fn();

    requireAdminPermission("products", "edit")({} as Request, response, next);
    await settleMiddleware();

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "You do not have permission to perform this action" });
    expect(next).not.toHaveBeenCalled();
  });
});
