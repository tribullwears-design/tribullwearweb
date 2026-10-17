import { describe, expect, it } from "vitest";
import { validateAdminAccountSettings, type AdminAccountSettingsInput } from "./adminAccountSettings";

const validName: AdminAccountSettingsInput = {
  name: "Updated Admin",
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
};

describe("admin account settings validation", () => {
  it("accepts a name-only update and trims surrounding whitespace", () => {
    expect(validateAdminAccountSettings({ ...validName, name: "  Updated Admin  " })).toBeNull();
  });

  it("requires all password fields and a strong confirmed new password", () => {
    expect(validateAdminAccountSettings({ ...validName, currentPassword: "old" })).toMatch(/current password/i);
    expect(validateAdminAccountSettings({
      ...validName,
      currentPassword: "old",
      newPassword: "weakpass",
      confirmNewPassword: "weakpass",
    })).toMatch(/letter and a number/i);
    expect(validateAdminAccountSettings({
      ...validName,
      currentPassword: "old",
      newPassword: "SecurePass123",
      confirmNewPassword: "different",
    })).toMatch(/do not match/i);
    expect(validateAdminAccountSettings({
      ...validName,
      currentPassword: "old",
      newPassword: "SecurePass123",
      confirmNewPassword: "SecurePass123",
    })).toBeNull();
  });

  it("validates and trims the admin's name", () => {
    expect(validateAdminAccountSettings({ ...validName, name: " " })).toMatch(/name/i);
    expect(validateAdminAccountSettings({ ...validName, name: "a".repeat(81) })).toMatch(/name/i);
  });
});
