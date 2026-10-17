import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { getSessionAdmin } from "./authService.js";
import { authorizeAdmin, requireAdmin, requireAdminPermission } from "./adminAuth.js";
import { fullAdminPermissions, getEffectiveAdminPermissions, type AdminPermissions } from "./adminPermissions.js";

vi.mock("./authService.js", () => ({ adminCookieName: "tribull_admin", getSessionAdmin: vi.fn() }));

const sessionLookup = vi.mocked(getSessionAdmin);

function responseMock() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
    locals: {},
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
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = responseMock();
    const next = vi.fn();

    requireAdmin({} as Request, response, next);
    await settleMiddleware();

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: "Sign in with an authorized admin account" });
    expect(warn).toHaveBeenCalledWith("Admin authorization denied", {
      category: "session_cookie_missing",
      method: undefined,
      path: undefined,
    });
    expect(next).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("diagnoses a present but unusable session cookie without logging its value", async () => {
    sessionLookup.mockResolvedValue(null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = responseMock();

    requireAdmin({ headers: { cookie: "tribull_admin=redacted" }, method: "GET", path: "/api/admin/products" } as Request, response, vi.fn());
    await settleMiddleware();

    expect(warn).toHaveBeenCalledWith("Admin authorization denied", {
      category: "invalid_or_expired_session",
      method: "GET",
      path: "/api/admin/products",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("redacted");
    warn.mockRestore();
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
    expect(authorizeAdmin(true, "admin", "Active", undefined, { section: "settings", action: "edit" }))
      .toEqual({ allowed: true });
  });

  it("allows a demo admin to view products while denying every other admin capability", () => {
    const productsReadOnly = Object.fromEntries(
      Object.keys(fullAdminPermissions).map((section) => [section, {
        view: section === "products",
        edit: false,
      }]),
    ) as AdminPermissions;

    expect(authorizeAdmin(true, "admin", "Active", productsReadOnly, { section: "products", action: "view" }))
      .toEqual({ allowed: true });
    expect(authorizeAdmin(true, "admin", "Active", productsReadOnly, { section: "products", action: "edit" }))
      .toMatchObject({ allowed: false, status: 403 });
    expect(authorizeAdmin(true, "admin", "Active", productsReadOnly, { section: "orders", action: "view" }))
      .toMatchObject({ allowed: false, status: 403 });
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

  it("enforces Manager and Staff read-only policy for products, orders, and customer data", () => {
    for (const role of ["Manager", "Staff"] as const) {
      const permissions = getEffectiveAdminPermissions(role, fullAdminPermissions);
      expect(authorizeAdmin(true, "admin", "Active", permissions, { section: "products", action: "view" }, role))
        .toEqual({ allowed: true });
      expect(authorizeAdmin(true, "admin", "Active", permissions, { section: "products", action: "edit" }, role))
        .toMatchObject({ allowed: false, status: 403 });
      expect(authorizeAdmin(true, "admin", "Active", permissions, { section: "customers", action: "view" }, role))
        .toMatchObject({ allowed: false, status: 403 });
      expect(authorizeAdmin(true, "admin", "Active", permissions, { section: "orders", action: "edit" }, role))
        .toMatchObject({ allowed: false, status: 403 });
    }
    expect(authorizeAdmin(true, "admin", "Active", getEffectiveAdminPermissions("Manager"), { section: "orders", action: "view" }, "Manager"))
      .toEqual({ allowed: true });
    expect(authorizeAdmin(true, "admin", "Active", getEffectiveAdminPermissions("Staff"), { section: "orders", action: "view" }, "Staff"))
      .toMatchObject({ allowed: false, status: 403 });
  });

  it("lets Admin edit general settings but denies Admin Users management without its explicit grant", () => {
    const permissions = getEffectiveAdminPermissions("Admin");
    expect(authorizeAdmin(true, "admin", "Active", permissions, { section: "settings", action: "edit" }, "Admin"))
      .toEqual({ allowed: true });
    expect(authorizeAdmin(true, "admin", "Active", permissions, { section: "adminUsers", action: "edit" }, "Admin"))
      .toMatchObject({ allowed: false, status: 403 });
  });
});
