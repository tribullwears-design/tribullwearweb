export type AdminAccountSettingsInput = {
  name: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

export function validateAdminAccountSettings(input: AdminAccountSettingsInput) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return "Name must be between 2 and 80 characters.";

  const passwordChangeRequested = Boolean(input.currentPassword || input.newPassword || input.confirmNewPassword);
  if (!passwordChangeRequested) return null;
  if (!input.currentPassword || !input.newPassword || !input.confirmNewPassword) {
    return "Enter your current password, new password, and confirmation.";
  }
  const passwordBytes = new TextEncoder().encode(input.newPassword).length;
  if (passwordBytes < 8 || passwordBytes > 72 || !/[A-Za-z]/.test(input.newPassword) || !/\d/.test(input.newPassword)) {
    return "New password must be 8–72 bytes and include a letter and a number.";
  }
  if (input.newPassword !== input.confirmNewPassword) return "New password and confirmation do not match.";
  return null;
}
