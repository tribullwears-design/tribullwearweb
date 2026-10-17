import { describe, expect, it } from "vitest";
import { getConfiguredAdminLoginEmail, getConfiguredAdminTestEmail, isAllowedAdminLoginEmail } from "./adminLoginConfig.js";

describe("admin login configuration", () => {
  it("names ADMIN_LOGIN_EMAIL when the server configuration is missing", () => {
    expect(() => getConfiguredAdminLoginEmail({})).toThrow(/ADMIN_LOGIN_EMAIL/);
  });

  it("rejects an invalid configured email without returning configuration values", () => {
    expect(() => getConfiguredAdminLoginEmail({ ADMIN_LOGIN_EMAIL: "invalid" })).toThrow(/valid email address/);
  });

  it("normalizes the configured admin email", () => {
    expect(getConfiguredAdminLoginEmail({ ADMIN_LOGIN_EMAIL: "  TRIBULLWEARS@GMAIL.COM " })).toBe("tribullwears@gmail.com");
  });

  it("allows the regular admin and separate configured testing email", () => {
    const regularEmail = getConfiguredAdminLoginEmail({ ADMIN_LOGIN_EMAIL: "regular@example.test" });
    const testEmail = getConfiguredAdminTestEmail({ ADMIN_TEST_EMAIL: "TEST@example.test" });
    expect(testEmail).toBe("test@example.test");
    expect(isAllowedAdminLoginEmail(" REGULAR@example.test ", regularEmail, testEmail)).toBe(true);
    expect(isAllowedAdminLoginEmail("Test@example.test", regularEmail, testEmail)).toBe(true);
    expect(isAllowedAdminLoginEmail("other@example.test", regularEmail, testEmail)).toBe(false);
  });
});
