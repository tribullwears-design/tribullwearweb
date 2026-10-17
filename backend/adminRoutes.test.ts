import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import bcrypt from "bcryptjs";
import { configureProxyTrust } from "./proxyTrust.js";

const mocks = vi.hoisted(() => ({
  sessionUser: null as {
    _id: { toString: () => string };
    name: string;
    email: string;
    mobile: string;
    authProviders: ("password" | "google")[];
    isProfileComplete: boolean;
    tokenVersion: number;
    adminAccountSource?: "user-credentials" | "admin-datas";
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
  updateOwnAdminAccountSettings: vi.fn(),
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

vi.mock("./adminAccountStore.js", () => ({
  AdminAccountSettingsError: class AdminAccountSettingsError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
  },
  updateOwnAdminAccountSettings: mocks.updateOwnAdminAccountSettings,
}));

import { adminLoginRateLimit, createAdminRouter } from "./adminRoutes.js";

let server: Server | undefined;
let origin: string;
let app: express.Express;

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
  mocks.updateOwnAdminAccountSettings.mockReset();

  app = express();
  configureProxyTrust(app);
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
  const login = (email = "admin@example.com", password = "incorrect-test-password", headers: Record<string, string> = {}) =>
    fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ email, password }),
    });

  it("limits failed attempts per normalized account and IP, with a separate IP-wide cap", async () => {
    expect(adminLoginRateLimit).toEqual({
      windowMs: 15 * 60 * 1000,
      perAccountIpLimit: 8,
      perIpLimit: 30,
    });
    expect(app.get("trust proxy")).toBe(false);

    expect((await login("", "missing-email")).status).toBe(400);
    expect((await login("admin@example.com", "")).status).toBe(400);
    const attempts = await Promise.all(Array.from({ length: adminLoginRateLimit.perAccountIpLimit }, () =>
      login(" ADMIN@EXAMPLE.COM ")));
    expect(attempts.every((response) => response.status === 401)).toBe(true);

    const blocked = await login();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("ratelimit-policy")).toContain("w=900");

    for (let attempt = 0; attempt < adminLoginRateLimit.perIpLimit - adminLoginRateLimit.perAccountIpLimit; attempt += 1) {
      expect((await login(`other${attempt}@example.com`)).status).toBe(401);
    }
    expect((await login("another@example.com")).status).toBe(429);
  });

  it("uses only the configured production proxy hop for the IP-wide limit", async () => {
    configureProxyTrust(app, { NODE_ENV: "production" });
    expect(app.get("trust proxy")).toBe(1);

    const loginThroughProxy = (ip: string, email: string) => fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
        forwarded: `for=${ip}`,
      },
      body: JSON.stringify({ email, password: "incorrect-test-password" }),
    });
    const firstClientResponses: Response[] = [];
    for (let attempt = 0; attempt < adminLoginRateLimit.perIpLimit; attempt += 1) {
      firstClientResponses.push(await loginThroughProxy("198.51.100.21", `user${attempt}@example.com`));
    }
    expect(firstClientResponses.every((response) => response.status === 401)).toBe(true);
    expect((await loginThroughProxy("198.51.100.21", "last@example.com")).status).toBe(429);
    expect((await loginThroughProxy("198.51.100.22", "last@example.com")).status).toBe(401);
  });

  it("does not limit authenticated session checks during normal dashboard use", async () => {
    const user = activeSuperAdmin();
    mocks.sessionUser = user;

    const sessionChecks = await Promise.all(Array.from({ length: 40 }, () =>
      fetch(`${origin}/api/admin/auth/me`, { headers: { cookie: "tribull_admin=test-session" } })));
    expect(sessionChecks.every((response) => response.status === 200)).toBe(true);
    expect(mocks.authenticateAdminLoginPassword).not.toHaveBeenCalled();
  });

  it("allows a successful login to clear stale failure counters", async () => {
    const user = activeSuperAdmin();
    for (let attempt = 0; attempt < adminLoginRateLimit.perAccountIpLimit - 1; attempt += 1) {
      mocks.authenticateAdminLoginPassword.mockResolvedValueOnce({ customer: null, reason: "invalid-password" });
    }
    mocks.authenticateAdminLoginPassword
      .mockResolvedValueOnce({ customer: user, reason: null, source: "user-credentials" })
      .mockResolvedValue({ customer: null, reason: "invalid-password" });

    for (let attempt = 0; attempt < adminLoginRateLimit.perAccountIpLimit - 1; attempt += 1) {
      expect((await login()).status).toBe(401);
    }
    expect((await login(user.email, "correct-test-password")).status).toBe(200);
    for (let attempt = 0; attempt < adminLoginRateLimit.perAccountIpLimit; attempt += 1) {
      expect((await login()).status).toBe(401);
    }
    expect((await login()).status).toBe(429);
    expect(mocks.authenticateAdminLoginPassword).toHaveBeenCalledTimes(adminLoginRateLimit.perAccountIpLimit * 2);
  });

  it("expires failed-login cooldown after fifteen minutes", async () => {
    let now = Date.now();
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      for (let attempt = 0; attempt < adminLoginRateLimit.perAccountIpLimit; attempt += 1) {
        expect((await login()).status).toBe(401);
      }
      expect((await login()).status).toBe(429);

      now += adminLoginRateLimit.windowMs + 1;
      const user = activeSuperAdmin();
      mocks.authenticateAdminLoginPassword.mockResolvedValue({ customer: user, reason: null, source: "user-credentials" });
      expect((await login(user.email, "correct-test-password")).status).toBe(200);
    } finally {
      dateNow.mockRestore();
    }
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

  it("authenticates an ADMIN_LOGIN_EMAIL account in admin-datas through normal session flow", async () => {
    vi.stubEnv("ADMIN_LOGIN_EMAIL", "testing-admin@example.test");
    vi.stubEnv("ADMIN_TEST_EMAIL", "");
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
      "testing-admin@example.test",
      null,
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
    expect(logout.headers.get("set-cookie")).toMatch(/tribull_admin=;.*Expires=Thu, 01 Jan 1970/i);
    expect(logout.headers.get("set-cookie")).not.toMatch(/tribull_customer=/i);
    expect(mocks.incrementAdminTokenVersion).toHaveBeenCalledWith(user._id.toString(), "admin-datas");
    expect((await fetch(`${origin}/api/admin/auth/me`, { headers: { cookie } })).status).toBe(401);
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

  it("rejects an account without an admin grant even when password authentication succeeds", async () => {
    const customer = {
      ...activeSuperAdmin(),
      adminRole: undefined,
    };
    mocks.authenticateAdminLoginPassword.mockResolvedValue({
      customer,
      reason: null,
      source: "user-credentials",
    });
    const response = await fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: customer.email, password: "valid-test-password" }),
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

  it("updates only the authenticated admin account and issues a renewed session after password changes", async () => {
    const user = { ...activeSuperAdmin(), adminAccountSource: "admin-datas" as const };
    mocks.sessionUser = user;
    const updatedAccount = { ...user, name: "Updated Admin" };
    mocks.updateOwnAdminAccountSettings.mockResolvedValue({
      account: updatedAccount,
      passwordChanged: true,
      source: "admin-datas",
    });

    const response = await fetch(`${origin}/api/admin/account`, {
      method: "PATCH",
      headers: {
        cookie: "tribull_admin=test-session",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: "507f1f77bcf86cd799439012",
        source: "user-credentials",
        role: "Super Admin",
        name: updatedAccount.name,
        currentPassword: "current-test-password",
        newPassword: "new-test-password-123",
        confirmNewPassword: "new-test-password-123",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: {
        id: user._id.toString(),
        name: updatedAccount.name,
        username: updatedAccount.name,
        email: user.email,
        mobile: user.mobile,
        isProfileComplete: true,
      },
    });
    expect(mocks.updateOwnAdminAccountSettings).toHaveBeenCalledWith(
      expect.objectContaining({ id: user._id.toString(), source: "admin-datas", role: "Super Admin" }),
      expect.objectContaining({ name: updatedAccount.name }),
    );
    expect(mocks.issueAdminSession).toHaveBeenCalledWith(expect.any(Object), updatedAccount, "admin-datas");
  });

  it("requires admin authentication before changing own account settings", async () => {
    const response = await fetch(`${origin}/api/admin/account`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "507f1f77bcf86cd799439011", name: "Updated Admin" }),
    });
    expect(response.status).toBe(401);
    expect(mocks.updateOwnAdminAccountSettings).not.toHaveBeenCalled();
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