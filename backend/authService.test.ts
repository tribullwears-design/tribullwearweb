import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { findCustomerByEmail, findCustomerById } from "./authStore.js";
import { authenticateAdminLoginPassword, authenticatePassword, adminCookieName, clearAdminSession, customerCookieName, getSessionAdmin, getSessionCustomer, hashPassword, issueAdminSession, issueCustomerSession } from "./authService.js";
import { getEffectiveAdminPermissions } from "./adminPermissions.js";

const adminTestMocks = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
}));
vi.mock("./authStore.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authStore.js")>();
  return { ...actual, findCustomerByEmail: vi.fn(), findCustomerById: vi.fn() };
});
vi.mock("./adminTestStore.js", () => ({
  findAdminTestAccountByEmail: adminTestMocks.findByEmail,
  findAdminTestAccountById: adminTestMocks.findById,
}));

const findCustomerByEmailMock = vi.mocked(findCustomerByEmail);
const findCustomer = vi.mocked(findCustomerById);

const customer = {
  _id: new ObjectId(),
  name: "Customer",
  email: "customer@example.com",
  mobile: "+919999999999",
  authProviders: ["password"] as ("password" | "google")[],
  isProfileComplete: true,
  tokenVersion: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const adminCustomer = { ...customer, adminRole: "admin" as const, adminTitle: "Super Admin" as const, adminTokenVersion: 2 };

beforeEach(() => {
  findCustomerByEmailMock.mockReset();
  findCustomer.mockReset();
  adminTestMocks.findByEmail.mockReset();
  adminTestMocks.findById.mockReset();
  findCustomerByEmailMock.mockResolvedValue(null);
  adminTestMocks.findByEmail.mockResolvedValue(null);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("JWT_SECRET", "a".repeat(32));
  vi.stubEnv("JWT_EXPIRES_IN", "7d");
  delete process.env.AUTH_COOKIE_SAME_SITE;
});

describe("password customer authentication", () => {
  it("accepts the existing password hash for a complete customer account", async () => {
    const passwordHash = await hashPassword("unit-test-password-not-for-login");
    findCustomerByEmailMock.mockResolvedValue({ ...customer, passwordHash });

    await expect(authenticatePassword("CUSTOMER@example.com", "unit-test-password-not-for-login"))
      .resolves.toMatchObject({ customer: { email: "customer@example.com" }, reason: null });
    expect(findCustomerByEmailMock).toHaveBeenCalledWith("CUSTOMER@example.com");
  });

  describe("admin-datas test account authentication", () => {
    it("verifies bcrypt credentials and restores a source-bound admin session", async () => {
      vi.stubEnv("ADMIN_TEST_EMAIL", "testing-admin@example.test");
      const password = "dedicated-test-account-password";
      const testingAdmin = {
        ...adminCustomer,
        email: "testing-admin@example.test",
        passwordHash: await hashPassword(password),
      };
      adminTestMocks.findByEmail.mockResolvedValue(testingAdmin);

      await expect(authenticateAdminLoginPassword(
        "TESTING-ADMIN@example.test",
        password,
        "regular-admin@example.test",
        "testing-admin@example.test",
      ))
        .resolves.toMatchObject({ customer: { email: "testing-admin@example.test" }, reason: null, source: "admin-datas" });
      await expect(authenticateAdminLoginPassword(
        "testing-admin@example.test",
        "wrong-password",
        "regular-admin@example.test",
        "testing-admin@example.test",
      ))
        .resolves.toMatchObject({ customer: null, reason: "invalid-password", source: null });

      let issuedToken = "";
      const response = {
        cookie: vi.fn((_name: string, token: string) => { issuedToken = token; }),
      } as unknown as Response;
      issueAdminSession(response, testingAdmin, "admin-datas");
      adminTestMocks.findById.mockResolvedValue(testingAdmin);

      const request = { headers: { cookie: `${adminCookieName}=${issuedToken}` } } as Request;
      await expect(getSessionAdmin(request)).resolves.toMatchObject({ adminAccountSource: "admin-datas" });
      expect(adminTestMocks.findById).toHaveBeenCalledWith(testingAdmin._id.toString());
      expect(findCustomer).not.toHaveBeenCalled();
    });

    it("authenticates a marked dedicated account independently of ADMIN_TEST_EMAIL", async () => {
      vi.stubEnv("ADMIN_TEST_EMAIL", "legacy-test@example.test");
      const password = "dedicated-account-password";
      const dedicatedAdmin = {
        ...adminCustomer,
        email: "dedicated-admin@example.test",
        adminAccountType: "dedicated" as const,
        passwordHash: await hashPassword(password),
      };
      adminTestMocks.findByEmail.mockResolvedValue(dedicatedAdmin);

      await expect(authenticateAdminLoginPassword(
        "DEDICATED-ADMIN@example.test",
        password,
        "regular-admin@example.test",
        "legacy-test@example.test",
      )).resolves.toMatchObject({
        customer: { email: "dedicated-admin@example.test", adminTitle: "Super Admin" },
        reason: null,
        source: "admin-datas",
      });
      expect(adminTestMocks.findByEmail).toHaveBeenCalledWith("dedicated-admin@example.test");
    });

    it("authenticates the regular admin through user-credentials with unchanged permissions", async () => {
      const regularAdmin = {
        ...adminCustomer,
        email: "regular-admin@example.test",
        adminTitle: "Admin" as const,
        passwordHash: await hashPassword("regular-admin-password"),
      };
      findCustomerByEmailMock.mockResolvedValue(regularAdmin);

      await expect(authenticateAdminLoginPassword(
        "REGULAR-ADMIN@example.test",
        "regular-admin-password",
        "regular-admin@example.test",
        "testing-admin@example.test",
      )).resolves.toMatchObject({ customer: { adminTitle: "Admin" }, reason: null, source: "user-credentials" });
      expect(getEffectiveAdminPermissions("Admin").products.edit).toBe(true);
      expect(getEffectiveAdminPermissions("Admin").adminUsers.view).toBe(false);
      expect(adminTestMocks.findByEmail).toHaveBeenCalledWith("regular-admin@example.test");
    });

    it("authenticates an ADMIN_LOGIN_EMAIL account from admin-datas with bcrypt", async () => {
      vi.stubEnv("ADMIN_LOGIN_EMAIL", "primary-admin@example.test");
      vi.stubEnv("ADMIN_TEST_EMAIL", "");
      const password = "primary-allowlist-admin-password";
      const superAdmin = {
        ...adminCustomer,
        email: "primary-admin@example.test",
        passwordHash: await hashPassword(password),
      };
      adminTestMocks.findByEmail.mockResolvedValue(superAdmin);

      await expect(authenticateAdminLoginPassword(
        " PRIMARY-ADMIN@EXAMPLE.TEST ",
        password,
        "primary-admin@example.test",
        null,
      )).resolves.toMatchObject({
        customer: { email: "primary-admin@example.test", adminTitle: "Super Admin" },
        reason: null,
        source: "admin-datas",
      });
      await expect(authenticateAdminLoginPassword(
        "primary-admin@example.test",
        "wrong-password",
        "primary-admin@example.test",
        null,
      )).resolves.toMatchObject({ customer: null, reason: "invalid-password", source: null });
      expect(findCustomerByEmailMock).toHaveBeenCalledWith("primary-admin@example.test");
      expect(adminTestMocks.findByEmail).toHaveBeenCalledWith("primary-admin@example.test");

      let issuedToken = "";
      const response = { cookie: vi.fn((_name: string, token: string) => { issuedToken = token; }) } as unknown as Response;
      issueAdminSession(response, superAdmin, "admin-datas");
      adminTestMocks.findById.mockResolvedValue(superAdmin);
      await expect(getSessionAdmin({
        headers: { cookie: `${adminCookieName}=${issuedToken}` },
      } as Request)).resolves.toMatchObject({ adminAccountSource: "admin-datas" });
    });

    it("rejects a valid password when a normalized email exists in both account collections", async () => {
      const password = "valid-but-ambiguous-password";
      const passwordHash = await hashPassword(password);
      const compare = vi.spyOn(bcrypt, "compare");
      findCustomerByEmailMock.mockResolvedValue({ ...adminCustomer, email: "testing-admin@example.test", passwordHash });
      adminTestMocks.findByEmail.mockResolvedValue({ ...adminCustomer, email: "testing-admin@example.test", passwordHash });

      await expect(authenticateAdminLoginPassword(
        " TESTING-ADMIN@EXAMPLE.TEST ",
        password,
        "regular-admin@example.test",
        "testing-admin@example.test",
      )).resolves.toEqual({ customer: null, reason: "ambiguous-account", source: null });
      expect(findCustomerByEmailMock).toHaveBeenCalledWith("testing-admin@example.test");
      expect(adminTestMocks.findByEmail).toHaveBeenCalledWith("testing-admin@example.test");
      expect(compare).not.toHaveBeenCalled();
    });

    it("checks both collections and still rejects an unknown email", async () => {
      await expect(authenticateAdminLoginPassword(
        "arbitrary@example.test",
        "password",
        "regular-admin@example.test",
        "testing-admin@example.test",
      ))
        .resolves.toMatchObject({ customer: null, reason: "not-found" });
      expect(adminTestMocks.findByEmail).toHaveBeenCalledWith("arbitrary@example.test");
      expect(findCustomerByEmailMock).toHaveBeenCalledWith("arbitrary@example.test");
    });
  });

  it("creates bcrypt cost-12 password hashes for password recovery", async () => {
    const password = "unit-test-password-for-reset";
    const passwordHash = await hashPassword(password);
    expect(passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(passwordHash).not.toBe(password);
  });

  it("rejects bad passwords and incomplete profiles without issuing a session", async () => {
    findCustomerByEmailMock.mockResolvedValue({ ...customer, passwordHash: await hashPassword("correct-password") });
    await expect(authenticatePassword("customer@example.com", "wrong-password"))
      .resolves.toMatchObject({ customer: null, reason: "invalid-password" });

    findCustomerByEmailMock.mockResolvedValue({
      ...customer,
      passwordHash: await hashPassword("correct-password"),
      isProfileComplete: false,
    });
    await expect(authenticatePassword("customer@example.com", "correct-password"))
      .resolves.toMatchObject({ customer: null, reason: "profile-incomplete" });
  });

  it("rejects an unknown email without exposing account details", async () => {
    findCustomerByEmailMock.mockResolvedValue(null);
    await expect(authenticatePassword("unknown@example.com", "some-password"))
      .resolves.toEqual({ customer: null, reason: "not-found" });
  });

  it("rejects an OAuth-only account without password credentials", async () => {
    findCustomerByEmailMock.mockResolvedValue({ ...customer, authProviders: ["google"], passwordHash: null });
    await expect(authenticatePassword("customer@example.com", "some-password"))
      .resolves.toEqual({ customer: null, reason: "invalid-password" });
  });

  it("rejects malformed password hashes", async () => {
    findCustomerByEmailMock.mockResolvedValue({ ...customer, passwordHash: "not-a-bcrypt-hash" });
    await expect(authenticatePassword("customer@example.com", "some-password"))
      .resolves.toEqual({ customer: null, reason: "invalid-password" });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("customer session cookies", () => {
  it("issues a cross-site production cookie and reads it back", async () => {
    let issuedToken = "";
    const response = {
      cookie: vi.fn((name: string, token: string) => {
        expect(name).toBe(customerCookieName);
        issuedToken = token;
      }),
    } as unknown as Response;

    issueCustomerSession(response, customer);

    expect(response.cookie).toHaveBeenCalledWith(
      customerCookieName,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: 7 * 24 * 60 * 60 * 1000 }),
    );

    findCustomer.mockResolvedValue(customer);
    await expect(getSessionCustomer({ headers: { cookie: `${customerCookieName}=${issuedToken}` } } as never)).resolves.toBe(customer);
  });
});

describe("dedicated admin session", () => {
  it("clears the admin cookie on logout", () => {
    const clearCookie = vi.fn();
    clearAdminSession({ clearCookie } as unknown as Response);
    expect(clearCookie).toHaveBeenCalledWith(adminCookieName, expect.objectContaining({ httpOnly: true, path: "/" }));
  });

  it("issues an HttpOnly admin cookie and restores only the admin audience session", async () => {
    let issuedToken = "";
    const response = {
      cookie: vi.fn((name: string, token: string, options: object) => {
        expect(name).toBe(adminCookieName);
        expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "none", path: "/" });
        issuedToken = token;
      }),
    } as unknown as Response;
    issueAdminSession(response, adminCustomer);

    findCustomer.mockResolvedValue(adminCustomer);
    const request = { headers: { cookie: `${adminCookieName}=${issuedToken}` } } as Request;
    await expect(getSessionAdmin(request)).resolves.toBe(adminCustomer);
    await expect(getSessionCustomer(request)).resolves.toBeNull();
  });

  it("invalidates an admin cookie when its admin token version is stale", async () => {
    let issuedToken = "";
    const response = { cookie: vi.fn((_name: string, token: string) => { issuedToken = token; }) } as unknown as Response;
    issueAdminSession(response, adminCustomer);
    findCustomer.mockResolvedValue({ ...adminCustomer, adminTokenVersion: 3 });
    await expect(getSessionAdmin({ headers: { cookie: `${adminCookieName}=${issuedToken}` } } as Request)).resolves.toBeNull();
  });
});
