import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import type { Response } from "express";
import { findCustomerById } from "./authStore.js";
import { customerCookieName, getSessionCustomer, issueCustomerSession } from "./authService.js";

vi.mock("./authStore.js", () => ({ findCustomerById: vi.fn() }));

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
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("JWT_SECRET", "a".repeat(32));
  vi.stubEnv("JWT_EXPIRES_IN", "7d");
  delete process.env.AUTH_COOKIE_SAME_SITE;
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
