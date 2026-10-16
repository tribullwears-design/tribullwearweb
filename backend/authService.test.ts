import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import type { Response } from "express";
import { findCustomerByEmail, findCustomerById } from "./authStore.js";
import { authenticatePassword, customerCookieName, getSessionCustomer, hashPassword, issueCustomerSession } from "./authService.js";

vi.mock("./authStore.js", () => ({ findCustomerByEmail: vi.fn(), findCustomerById: vi.fn() }));

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

beforeEach(() => {
  findCustomerByEmailMock.mockReset();
  findCustomer.mockReset();
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
