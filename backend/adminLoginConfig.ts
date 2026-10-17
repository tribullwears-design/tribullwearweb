import { isValidCustomerEmail, normalizeCustomerEmail } from "./authStore.js";

export function getConfiguredAdminLoginEmail(environment: NodeJS.ProcessEnv = process.env) {
  const value = environment.ADMIN_LOGIN_EMAIL?.trim();
  if (!value) {
    throw new Error("Missing required server environment variable ADMIN_LOGIN_EMAIL (set it in backend/.env.local or the backend process environment)");
  }
  const email = normalizeCustomerEmail(value);
  if (!isValidCustomerEmail(email)) {
    throw new Error("ADMIN_LOGIN_EMAIL must contain a valid email address");
  }
  return email;
}

export function getConfiguredAdminTestEmail(environment: NodeJS.ProcessEnv = process.env) {
  const value = environment.ADMIN_TEST_EMAIL?.trim();
  if (!value) return null;
  const email = normalizeCustomerEmail(value);
  if (!isValidCustomerEmail(email)) throw new Error("ADMIN_TEST_EMAIL must contain a valid email address");
  return email;
}

export function isAllowedAdminLoginEmail(
  email: string,
  regularAdminEmail: string,
  testAdminEmail: string | null,
) {
  const normalizedEmail = normalizeCustomerEmail(email);
  return normalizedEmail === regularAdminEmail || normalizedEmail === testAdminEmail;
}
