import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import bcrypt from "bcryptjs";

const mocks = vi.hoisted(() => ({
  sessionUser: null as {
    _id: { toString: () => string };
    name: string;
    email: string;
    mobile: string;
    authProviders: ("password" | "google")[];
    isProfileComplete: boolean;
    tokenVersion: number;
    adminAccountSource?: "admin-datas";
    adminRole?: "admin";
    adminTitle?: "Super Admin" | "Admin" | "Manager" | "Staff";
    adminStatus?: "Active" | "Inactive";
  } | null,
  sessionRevoked: false as boolean,
  findCustomerByEmail: vi.fn(),
  authenticateAdminLoginPassword: vi.fn(),
  issueAdminSession: vi.fn(),
  incrementAdminTokenVersion: vi.fn(),
  listAdminUserRecords: vi.fn(),
  listAdminUsers: vi.fn(),
  createAdminUser: vi.fn(),
  createDedicatedAdminAccount: vi.fn(),
  deactivateDedicatedAdminAccount: vi.fn(),
  listDedicatedAdminAccounts: vi.fn(),
  updateDedicatedAdminAccount: vi.fn(),
  updateAdminUser: vi.fn(),
}));

vi.mock("./authStore.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authStore.js")>();
  return {
    ...actual,
    findCustomerByEmail: mocks.findCustomerByEmail,
    incrementAdminTokenVersion: mocks.incrementAdminTokenVersion.mockImplementation(async () => { mocks.sessionRevoked = true; }),
  };
});

vi.mock("./authService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authService.js")>();
  return {
    ...actual,
    authenticateAdminLoginPassword: mocks.authenticateAdminLoginPassword,
    clearAdminSession: vi.fn((response: { clearCookie: (name: string, options: object) => void }) =>
      response.clearCookie("tribull_admin", { httpOnly: true, path: "/", sameSite: "lax" })),
    getSessionAdmin: vi.fn(async (request: { headers: { cookie?: string } }) =>
      !mocks.sessionRevoked && request.headers.cookie?.includes("tribull_admin=test-session") ? mocks.sessionUser : null),
    issueAdminSession: mocks.issueAdminSession.mockImplementation((response: { cookie: (name: string, value: string, options: object) => void }) =>
      response.cookie("tribull_admin", "test-session", { httpOnly: true, secure: false, sameSite: "lax", path: "/" })),
    validateCustomerAuthConfiguration: vi.fn(),
  };
});

vi.mock("./adminUserStore.js", () => ({
  AdminUserConflictError: class AdminUserConflictError extends Error {},
  AdminUserValidationError: class AdminUserValidationError extends Error {},
  createAdminUser: mocks.createAdminUser,
  createDedicatedAdminAccount: mocks.createDedicatedAdminAccount,
  deactivateDedicatedAdminAccount: mocks.deactivateDedicatedAdminAccount,
  listDedicatedAdminAccounts: mocks.listDedicatedAdminAccounts,
  updateDedicatedAdminAccount: mocks.updateDedicatedAdminAccount,
  listAdminUserRecords: mocks.listAdminUserRecords,
  listAdminUsers: mocks.listAdminUsers,
  updateAdminUser: mocks.updateAdminUser,
}));

import { adminLoginRateLimit, createAdminRouter } from "./adminRoutes.js";

let server: Server | undefined;
let origin: string;

beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ADMIN_LOGIN_EMAIL", "admin@example.com");
  vi.stubEnv("ADMIN_TEST_EMAIL", "");
  mocks.sessionUser = null;
  mocks.sessionRevoked = false;
  mocks.findCustomerByEmail.mockReset().mockResolvedValue(null);
  mocks.authenticateAdminLoginPassword.mockReset().mockResolvedValue({ customer: null, reason: "not-found" });
  mocks.issueAdminSession.mockReset().mockImplementation((response: { cookie: (name: string, value: string, options: object) => void }) =>
    response.cookie("tribull_admin", "test-session", { httpOnly: true, secure: false, sameSite: "lax", path: "/" }));
  mocks.incrementAdminTokenVersion.mockClear();
  mocks.listAdminUsers.mockReset().mockResolvedValue([]);
  mocks.listAdminUserRecords.mockReset().mockResolvedValue([]);
  mocks.createAdminUser.mockReset();
  mocks.createDedicatedAdminAccount.mockReset();
  mocks.deactivateDedicatedAdminAccount.mockReset();
  mocks.listDedicatedAdminAccounts.mockReset().mockResolvedValue([]);
  mocks.updateDedicatedAdminAccount.mockReset();
  mocks.updateAdminUser.mockReset();

  const app = express();
  app.use(express.json());
  app.use(createAdminRouter());
  server = createServer(app);
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
  origin = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  }
  server = undefined;
});

function activeSuperAdmin() {
  return {
    _id: { toString: () => "507f1f77bcf86cd799439011" },
    name: "Test Admin",
    email: "admin@example.com",
    mobile: "",
    authProviders: ["password"] as ("password" | "google")[],
    isProfileComplete: true,
    tokenVersion: 1,
    adminRole: "admin" as const,
    adminTitle: "Super Admin" as const,
    adminStatus: "Active" as const,
  };
}

describe("admin HTTP routes", () => {
  it("limits only admin login to eight requests per IP in a 15-minute window", async () => {
    expect(adminLoginRateLimit).toEqual({ limit: 8, windowMs: 15 * 60 * 1000 });

    const attempts = await Promise.all(Array.from({ length: adminLoginRateLimit.limit }, () =>
      fetch(`${origin}/api/admin/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })));
    expect(attempts.every((response) => response.status === 400)).toBe(true);

    const blocked = await fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("ratelimit-policy")).toMatch(/q=8; w=900/);
    expect(mocks.authenticateAdminLoginPassword).not.toHaveBeenCalled();
  });

  it("does not consume the login limit for session checks and still permits a successful login", async () => {
    const user = activeSuperAdmin();
    mocks.authenticateAdminLoginPassword.mockResolvedValue({ customer: user, reason: null, source: "user-credentials" });
    mocks.sessionUser = user;

    const sessionChecks = await Promise.all(Array.from({ length: 12 }, () =>
      fetch(`${origin}/api/admin/auth/me`)));
    expect(sessionChecks.every((response) => response.status === 401)).toBe(true);

    const login = await fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password: "provided-by-test" }),
    });
    expect(login.status).toBe(200);
    expect(mocks.authenticateAdminLoginPassword).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid credentials without issuing a session cookie", async () => {
    const customer = {
      ...activeSuperAdmin(),
      passwordHash: await bcrypt.hash("valid-test-password", 12),
    };
    mocks.authenticateAdminLoginPassword.mockResolvedValue({ customer: null, reason: "invalid-password" });
    const response = await fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "incorrect-test-password" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Email or password is incorrect" });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.authenticateAdminLoginPassword).toHaveBeenCalledWith(
      customer.email,
      "incorrect-test-password",
      "admin@example.com",
      null,
    );
  });

  it("logs only a safe category when an email matches both account collections", async () => {
    vi.stubEnv("ADMIN_TEST_EMAIL", "testing-admin@example.test");
    mocks.authenticateAdminLoginPassword.mockResolvedValue({
      customer: null,
      reason: "ambiguous-account",
      source: null,
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "testing-admin@example.test", password: "not-logged" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Email or password is incorrect" });
    expect(warning).toHaveBeenCalledWith("Admin sign-in rejected", {
      category: "ambiguous_account_match",
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("testing-admin@example.test");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("not-logged");
    warning.mockRestore();
  });

  it("authenticates the configured admin-datas account through normal session and authorization flow", async () => {
    vi.stubEnv("ADMIN_LOGIN_EMAIL", "regular-admin@example.test");
    vi.stubEnv("ADMIN_TEST_EMAIL", "testing-admin@example.test");
    const user = {
      ...activeSuperAdmin(),
      email: "testing-admin@example.test",
      adminAccountSource: "admin-datas" as const,
    };
    mocks.authenticateAdminLoginPassword.mockResolvedValue({ customer: user, reason: null, source: "admin-datas" });
    mocks.sessionUser = user;

    const login = await fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email.toUpperCase(), password: "provided-by-test" }),
    });
    expect(login.status).toBe(200);
    expect(mocks.authenticateAdminLoginPassword).toHaveBeenCalledWith(
      user.email.toUpperCase(),
      "provided-by-test",
      "regular-admin@example.test",
      "testing-admin@example.test",
    );
    expect(mocks.issueAdminSession).toHaveBeenCalledWith(expect.any(Object), user, "admin-datas");
    expect(mocks.findCustomerByEmail).not.toHaveBeenCalled();
    expect(await login.json()).toMatchObject({
      admin: { role: "Super Admin", permissions: { dashboard: { view: true, edit: true } } },
    });

    const cookie = "tribull_admin=test-session";
    expect((await fetch(`${origin}/api/admin/users`, { headers: { cookie } })).status).toBe(200);
    expect((await fetch(`${origin}/api/admin/users`)).status).toBe(401);

    const logout = await fetch(`${origin}/api/admin/auth/logout`, {
      method: "POST",
      headers: { cookie },
    });
    expect(logout.status).toBe(204);
    expect(mocks.incrementAdminTokenVersion).toHaveBeenCalledWith(user._id.toString(), "admin-datas");
  });

  it("allows only an authenticated Super Admin to create a dedicated account", async () => {
    const cookie = "tribull_admin=test-session";
    mocks.createDedicatedAdminAccount.mockResolvedValue({
      id: "507f1f77bcf86cd799439012",
      name: "New Dedicated Admin",
      email: "new-admin@example.test",
      phone: "",
      role: "Manager",
      status: "Active",
      permissions: {},
    });

    const unauthenticated = await fetch(`${origin}/api/admin/users/dedicated`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new-admin@example.test" }),
    });
    expect(unauthenticated.status).toBe(401);

    mocks.sessionUser = { ...activeSuperAdmin(), adminTitle: "Admin" };
    const regularAdmin = await fetch(`${origin}/api/admin/users/dedicated`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ email: "new-admin@example.test" }),
    });
    expect(regularAdmin.status).toBe(403);
    expect(mocks.createDedicatedAdminAccount).not.toHaveBeenCalled();

    mocks.sessionUser = activeSuperAdmin();
    const created = await fetch(`${origin}/api/admin/users/dedicated`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: "New Dedicated Admin",
        email: "new-admin@example.test",
        password: "password-only-in-request",
        role: "Manager",
        status: "Active",
        permissions: {},
      }),
    });
    expect(created.status).toBe(201);
    const responseBody = await created.json() as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      name: "New Dedicated Admin",
      email: "new-admin@example.test",
      role: "Manager",
    });
    expect(JSON.stringify(responseBody)).not.toContain("passwordHash");
    expect(mocks.createDedicatedAdminAccount).toHaveBeenCalledOnce();
  });

  it("protects dedicated-account listing, update, and deactivation with the authenticated Super Admin session", async () => {
    const cookie = "tribull_admin=test-session";
    const accountId = "507f1f77bcf86cd799439012";
    const result = {
      id: accountId,
      name: "Dedicated Admin",
      email: "dedicated@example.test",
      phone: "",
      role: "Manager",
      status: "Inactive",
      permissions: {},
    };
    mocks.listDedicatedAdminAccounts.mockResolvedValue([result]);
    mocks.updateDedicatedAdminAccount.mockResolvedValue(result);
    mocks.deactivateDedicatedAdminAccount.mockResolvedValue(result);

    expect((await fetch(`${origin}/api/admin/users/dedicated`)).status).toBe(401);
    expect((await fetch(`${origin}/api/admin/users/dedicated/${accountId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })).status).toBe(401);
    expect((await fetch(`${origin}/api/admin/users/dedicated/${accountId}`, {
      method: "DELETE",
    })).status).toBe(401);

    mocks.sessionUser = { ...activeSuperAdmin(), adminTitle: "Admin" };
    expect((await fetch(`${origin}/api/admin/users/dedicated`, { headers: { cookie } })).status).toBe(403);
    expect((await fetch(`${origin}/api/admin/users/dedicated/${accountId}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({}),
    })).status).toBe(403);
    expect((await fetch(`${origin}/api/admin/users/dedicated/${accountId}`, {
      method: "DELETE",
      headers: { cookie },
    })).status).toBe(403);

    mocks.sessionUser = activeSuperAdmin();
    expect((await fetch(`${origin}/api/admin/users/dedicated`, { headers: { cookie } })).status).toBe(200);
    expect((await fetch(`${origin}/api/admin/users/dedicated/${accountId}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ role: "Manager" }),
    })).status).toBe(200);
    expect((await fetch(`${origin}/api/admin/users/dedicated/${accountId}`, {
      method: "DELETE",
      headers: { cookie },
    })).status).toBe(200);

    expect(mocks.listDedicatedAdminAccounts).toHaveBeenCalledOnce();
    expect(mocks.updateDedicatedAdminAccount).toHaveBeenCalledWith(accountId, { role: "Manager" }, expect.objectContaining({
      id: activeSuperAdmin()._id.toString(),
      role: "Super Admin",
    }));
    expect(mocks.deactivateDedicatedAdminAccount).toHaveBeenCalledWith(accountId, expect.objectContaining({
      id: activeSuperAdmin()._id.toString(),
      role: "Super Admin",
    }));
  });

  it("rejects login for a valid-password but inactive dedicated admin without issuing a session", async () => {
    const inactiveDedicated = {
      ...activeSuperAdmin(),
      email: "inactive-admin@example.test",
      adminStatus: "Inactive" as const,
      adminAccountSource: "admin-datas" as const,
    };
    mocks.authenticateAdminLoginPassword.mockResolvedValue({
      customer: inactiveDedicated,
      reason: null,
      source: "admin-datas",
    });
    const response = await fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: inactiveDedicated.email, password: "valid-test-password" }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.issueAdminSession).not.toHaveBeenCalled();
  });

  it("allows the regular admin to log in while a separate test email is configured", async () => {
    vi.stubEnv("ADMIN_LOGIN_EMAIL", "regular-admin@example.test");
    vi.stubEnv("ADMIN_TEST_EMAIL", "testing-admin@example.test");
    const regularAdmin = {
      ...activeSuperAdmin(),
      email: "regular-admin@example.test",
      adminTitle: "Admin" as const,
    };
    mocks.authenticateAdminLoginPassword.mockResolvedValue({ customer: regularAdmin, reason: null, source: "user-credentials" });
    mocks.sessionUser = regularAdmin;

    const response = await fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "REGULAR-ADMIN@example.test", password: "valid-password" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.authenticateAdminLoginPassword).toHaveBeenCalledWith(
      "REGULAR-ADMIN@example.test",
      "valid-password",
      "regular-admin@example.test",
      "testing-admin@example.test",
    );
    expect(mocks.issueAdminSession).toHaveBeenCalledWith(expect.any(Object), regularAdmin, "user-credentials");
    expect(await response.json()).toMatchObject({ admin: { role: "Admin" } });
  });

  it("rejects an unknown email after checking for a dedicated admin account", async () => {
    vi.stubEnv("ADMIN_TEST_EMAIL", "testing-admin@example.test");
    const response = await fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "outside@example.test", password: "not-logged" }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Email or password is incorrect" });
    expect(mocks.authenticateAdminLoginPassword).toHaveBeenCalledWith(
      "outside@example.test",
      "not-logged",
      "admin@example.com",
      "testing-admin@example.test",
    );
  });

  it("issues an HttpOnly session, restores /me, and gates Admin Users CRUD", async () => {
    const user = { ...activeSuperAdmin(), passwordHash: await bcrypt.hash("valid-test-password", 12) };
    mocks.authenticateAdminLoginPassword.mockResolvedValue({ customer: user, reason: null, source: "user-credentials" });
    mocks.sessionUser = user;
    const login = await fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "valid-test-password" }),
    });
    const setCookie = login.headers.get("set-cookie");
    expect(login.status).toBe(200);
    expect(setCookie).toMatch(/tribull_admin=test-session/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(await login.json()).toMatchObject({ admin: { role: "Super Admin" } });

    const cookie = "tribull_admin=test-session";
    const session = await fetch(`${origin}/api/admin/auth/me`, { headers: { cookie } });
    expect(session.status).toBe(200);
    const sessionBody = await session.json() as Record<string, unknown>;
    expect(sessionBody).toMatchObject({
      user: { name: user.name, email: user.email },
      admin: { role: "Super Admin" },
    });
    expect(JSON.stringify(sessionBody)).not.toContain("passwordHash");

    const users = await fetch(`${origin}/api/admin/users`, { headers: { cookie } });
    expect(users.status).toBe(200);
    expect(await users.json()).toEqual([]);

    mocks.createAdminUser.mockResolvedValue({ id: "507f1f77bcf86cd799439012", role: "Staff" });
    const created = await fetch(`${origin}/api/admin/users`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ email: "staff@example.com" }),
    });
    expect(created.status).toBe(201);
    expect(mocks.createAdminUser).toHaveBeenCalledOnce();

    const denied = await fetch(`${origin}/api/admin/users`);
    expect(denied.status).toBe(401);
    const deniedCreate = await fetch(`${origin}/api/admin/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "staff@example.com" }),
    });
    expect(deniedCreate.status).toBe(401);
    expect(mocks.listAdminUsers).toHaveBeenCalledOnce();
    expect(mocks.createAdminUser).toHaveBeenCalledOnce();
  });

  it("limits combined admin-account records to authenticated Super Admin sessions", async () => {
    const cookie = { cookie: "tribull_admin=test-session" };
    mocks.sessionUser = {
      ...activeSuperAdmin(),
      adminTitle: "Admin",
    };
    const denied = await fetch(`${origin}/api/admin/users/records`, { headers: cookie });
    expect(denied.status).toBe(403);
    expect(mocks.listAdminUserRecords).not.toHaveBeenCalled();

    mocks.sessionUser = {
      ...activeSuperAdmin(),
      adminStatus: "Inactive",
    };
    const inactive = await fetch(`${origin}/api/admin/users/records`, { headers: cookie });
    expect(inactive.status).toBe(403);
    expect(mocks.listAdminUserRecords).not.toHaveBeenCalled();

    mocks.sessionUser = activeSuperAdmin();
    const records = [{
      email: "admin@example.com",
      records: [{
        id: "507f1f77bcf86cd799439011",
        source: "admin-datas",
        name: "Test Admin",
        role: "Super Admin",
        status: "Active",
        permissions: {},
      }],
    }];
    mocks.listAdminUserRecords.mockResolvedValue(records);
    const allowed = await fetch(`${origin}/api/admin/users/records`, { headers: cookie });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual(records);
    expect(mocks.listAdminUserRecords).toHaveBeenCalledOnce();

    const unauthenticated = await fetch(`${origin}/api/admin/users/records`);
    expect(unauthenticated.status).toBe(401);
  });

  it("revokes the admin session and clears its cookie on logout", async () => {
    mocks.sessionUser = activeSuperAdmin();
    const response = await fetch(`${origin}/api/admin/auth/logout`, {
      method: "POST",
      headers: { cookie: "tribull_admin=test-session" },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toMatch(/tribull_admin=;/);
    expect(response.headers.get("set-cookie")).toMatch(/Expires=Thu, 01 Jan 1970/i);
    expect(mocks.incrementAdminTokenVersion).toHaveBeenCalledWith("507f1f77bcf86cd799439011", "user-credentials");
    const session = await fetch(`${origin}/api/admin/auth/me`, { headers: { cookie: "tribull_admin=test-session" } });
    expect(session.status).toBe(401);
  });
});