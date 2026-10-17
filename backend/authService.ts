import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import jwt, { type JwtPayload } from "jsonwebtoken";
import nodemailer from "nodemailer";
import type { Request, Response } from "express";
import {
  findCustomerByEmail,
  findCustomerByGoogleId,
  findCustomerById,
  insertCustomer,
  normalizeCustomerEmail,
  normalizeCustomerMobile,
  updateGoogleProfile,
  type CustomerDocument,
} from "./authStore.js";
import { findAdminTestAccountByEmail, findAdminTestAccountById } from "./adminTestStore.js";
import { getConfiguredAdminTestEmail } from "./adminLoginConfig.js";

export const customerCookieName = "tribull_customer";
export const adminCookieName = "tribull_admin";
export const passwordResetCookieName = "tribull_password_reset";
const passwordCost = 12;
const passwordResetAuthorizationLifetimeMs = 10 * 60 * 1000;

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("JWT_SECRET must contain at least 32 bytes");
  return secret;
}

function expirySeconds() {
  const value = process.env.JWT_EXPIRES_IN || "7d";
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) throw new Error("JWT_EXPIRES_IN must use seconds, minutes, hours, or days");
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as "s" | "m" | "h" | "d"];
  const seconds = Number(match[1]) * factor;
  if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 30 * 86400) throw new Error("JWT_EXPIRES_IN is outside the supported range");
  return seconds;
}

function cookieSettings() {
  const configuredSameSite = process.env.AUTH_COOKIE_SAME_SITE
    || (process.env.NODE_ENV === "production" ? "none" : "lax");
  const sameSite = configuredSameSite.toLowerCase();
  if (!["strict", "lax", "none"].includes(sameSite)) throw new Error("AUTH_COOKIE_SAME_SITE must be strict, lax, or none");
  const secure = process.env.NODE_ENV === "production";
  if (sameSite === "none" && !secure) throw new Error("SameSite=None cookies require HTTPS");
  return { httpOnly: true as const, secure, sameSite: sameSite as "strict" | "lax" | "none", path: "/" as const };
}

export function validateCustomerAuthConfiguration() {
  jwtSecret();
  expirySeconds();
  cookieSettings();
}

export function issueCustomerSession(response: Response, customer: CustomerDocument) {
  if (!customer._id) throw new Error("Cannot create a customer session without a customer ID");
  const expiresIn = expirySeconds();
  const token = jwt.sign({ ver: customer.tokenVersion, type: "customer" }, jwtSecret(), {
    subject: customer._id.toString(),
    expiresIn,
    issuer: "tribull-store",
    audience: "tribull-customer",
  });
  response.cookie(customerCookieName, token, { ...cookieSettings(), maxAge: expiresIn * 1000 });
}

export function issueAdminSession(response: Response, customer: CustomerDocument, source: "user-credentials" | "admin-datas" = "user-credentials") {
  if (!customer._id) throw new Error("Cannot create an admin session without a customer ID");
  const expiresIn = expirySeconds();
  const token = jwt.sign({ ver: customer.adminTokenVersion ?? 0, type: "admin", source }, jwtSecret(), {
    subject: customer._id.toString(), expiresIn, issuer: "tribull-store", audience: "tribull-admin",
  });
  response.cookie(adminCookieName, token, { ...cookieSettings(), maxAge: expiresIn * 1000 });
}

export function clearAdminSession(response: Response) {
  response.clearCookie(adminCookieName, cookieSettings());
}

export function clearCustomerSession(response: Response) {
  response.clearCookie(customerCookieName, cookieSettings());
}

export function setPasswordResetAuthorization(response: Response, token: string) {
  response.cookie(passwordResetCookieName, token, {
    ...cookieSettings(),
    maxAge: passwordResetAuthorizationLifetimeMs,
  });
}

export function clearPasswordResetAuthorization(response: Response) {
  response.clearCookie(passwordResetCookieName, cookieSettings());
}

function readCookie(request: Request, name: string) {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}

export function getPasswordResetAuthorization(request: Request) {
  return readCookie(request, passwordResetCookieName);
}

export async function getSessionCustomer(request: Request) {
  const token = readCookie(request, customerCookieName);
  if (!token) return null;
  let claims: string | JwtPayload;
  try {
    claims = jwt.verify(token, jwtSecret(), { issuer: "tribull-store", audience: "tribull-customer" });
  } catch {
    return null;
  }
  if (typeof claims === "string" || claims.type !== "customer" || typeof claims.sub !== "string" || typeof claims.ver !== "number") return null;
  const customer = await findCustomerById(claims.sub);
  if (!customer || customer.tokenVersion !== claims.ver || !customer.isProfileComplete) return null;
  return customer;
}

export async function getSessionAdmin(request: Request) {
  const token = readCookie(request, adminCookieName);
  if (!token) return null;
  let claims: string | JwtPayload;
  try {
    claims = jwt.verify(token, jwtSecret(), { issuer: "tribull-store", audience: "tribull-admin" });
  } catch {
    return null;
  }
  if (typeof claims === "string" || claims.type !== "admin" || typeof claims.sub !== "string" || typeof claims.ver !== "number") return null;
  const source = claims.source === undefined || claims.source === "user-credentials"
    ? "user-credentials"
    : claims.source === "admin-datas" ? "admin-datas" : null;
  if (!source) return null;
  const customer = source === "admin-datas"
    ? await findAdminTestAccountById(claims.sub)
    : await findCustomerById(claims.sub);
  if (!customer || (customer.adminTokenVersion ?? 0) !== claims.ver || !customer.isProfileComplete) return null;
  if (source === "admin-datas") {
    const configuredEmail = getConfiguredAdminTestEmail();
    if (!configuredEmail || normalizeCustomerEmail(customer.email) !== configuredEmail) return null;
  }
  customer.adminAccountSource = source;
  return customer;
}

export function createPendingGoogleToken(profile: { sub: string; email: string; name: string }) {
  return jwt.sign({ type: "google-profile", email: profile.email, name: profile.name }, jwtSecret(), {
    subject: profile.sub,
    expiresIn: 600,
    issuer: "tribull-store",
    audience: "tribull-google-profile",
  });
}

export function readPendingGoogleToken(token: string) {
  const claims = jwt.verify(token, jwtSecret(), { issuer: "tribull-store", audience: "tribull-google-profile" });
  if (typeof claims === "string" || claims.type !== "google-profile" || typeof claims.sub !== "string" || typeof claims.email !== "string" || typeof claims.name !== "string") {
    throw new Error("Invalid Google profile completion token");
  }
  return { sub: claims.sub, email: claims.email, name: claims.name };
}

export async function createPasswordCustomer(name: string, email: string, mobile: string, password: string) {
  const normalizedEmail = normalizeCustomerEmail(email);
  const normalizedMobile = normalizeCustomerMobile(mobile);
  const existing = await findCustomerByEmail(normalizedEmail);
  if (existing) return null;

  const passwordHash = await bcrypt.hash(password, passwordCost);
  try {
    return await insertCustomer({
      name: name.trim(),
      email: normalizedEmail,
      mobile: normalizedMobile,
      passwordHash,
      authProviders: ["password"],
      isProfileComplete: true,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return null;
    throw error;
  }
}

export async function authenticatePassword(email: string, password: string) {
  const customer = await findCustomerByEmail(email);
  return authenticateCustomerPassword(customer, password);
}

export async function authenticateAdminLoginPassword(
  email: string,
  password: string,
  regularAdminEmail: string,
  testAdminEmail: string | null,
) {
  const normalizedEmail = normalizeCustomerEmail(email);
  const canAuthenticateRegular = normalizedEmail === regularAdminEmail;
  const canAuthenticateTest = normalizedEmail === testAdminEmail;
  if (!canAuthenticateRegular && !canAuthenticateTest) {
    return { customer: null, reason: "not-found" as const };
  }

  const [regularAdmin, testAdmin] = await Promise.all([
    findCustomerByEmail(normalizedEmail),
    findAdminTestAccountByEmail(normalizedEmail),
  ]);
  if (regularAdmin && testAdmin) {
    return { customer: null, reason: "ambiguous-account" as const, source: null };
  }

  if (canAuthenticateTest && testAdmin) {
    const result = await authenticateCustomerPassword(testAdmin, password);
    return { ...result, source: result.customer ? "admin-datas" as const : null };
  }
  if (canAuthenticateRegular && regularAdmin) {
    const result = await authenticateCustomerPassword(regularAdmin, password);
    return { ...result, source: result.customer ? "user-credentials" as const : null };
  }
  return { customer: null, reason: "not-found" as const, source: null };
}

async function authenticateCustomerPassword(customer: CustomerDocument | null, password: string) {
  if (!customer) return { customer: null, reason: "not-found" as const };
  if (!customer.passwordHash || !await bcrypt.compare(password, customer.passwordHash)) return { customer: null, reason: "invalid-password" as const };
  if (!customer.isProfileComplete) return { customer: null, reason: "profile-incomplete" as const };
  return { customer, reason: null };
}

export async function verifyGoogleCredential(credential: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured");
  const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: credential, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new Error("Google did not return a verified email address");
  return {
    sub: payload.sub,
    email: normalizeCustomerEmail(payload.email),
    name: typeof payload.name === "string" ? payload.name.trim() : "",
  };
}

export async function findGoogleCustomer(googleId: string) {
  return findCustomerByGoogleId(googleId);
}

export async function completeGoogleProfile(sub: string, name: string, mobile: string) {
  const normalizedMobile = normalizeCustomerMobile(mobile);
  const already = await findCustomerByGoogleId(sub);
  if (already) return updateGoogleProfile(sub, name.trim(), normalizedMobile);
  return null;
}

export async function insertGoogleCustomer(profile: { sub: string; email: string; name: string }, name: string, mobile: string) {
  try {
    return await insertCustomer({
      name: name.trim(),
      email: profile.email,
      mobile: normalizeCustomerMobile(mobile),
      googleId: profile.sub,
      authProviders: ["google"],
      isProfileComplete: true,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return findCustomerByGoogleId(profile.sub);
    }
    throw error;
  }
}

export function passwordResetDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetAuthorization() {
  const token = randomBytes(32).toString("base64url");
  return { token, digest: passwordResetDigest(token) };
}

export function createEmailOtp(email: string) {
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return { otp, digest: passwordOtpDigest(email, otp) };
}

export function passwordOtpDigest(email: string, otp: string) {
  return createHmac("sha256", jwtSecret()).update(`${normalizeCustomerEmail(email)}:${otp}`).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, passwordCost);
}

export function sendPasswordResetOtpEmail(email: string, name: string, otp: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) throw new Error("Password recovery email is not configured");
  if (SMTP_USER === "yourgmail@gmail.com" || SMTP_PASS === "your_16_character_app_password") throw new Error("SMTP credentials are placeholders");
  if (!Number.isInteger(Number(SMTP_PORT)) || Number(SMTP_PORT) < 1 || Number(SMTP_PORT) > 65535) throw new Error("SMTP_PORT must be a valid port number");
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter.sendMail({
    from: SMTP_USER,
    to: email,
    subject: "Tribull Password Reset OTP",
    text: `Hello ${name},\n\nYour Tribull password reset verification code is: ${otp}\n\nThis code expires in 5 minutes. You have up to 5 attempts to verify it.\n\nIf you did not request this, ignore this email.`,
  });
}

export function passwordResetAuthorizationExpiry(now = new Date()) {
  return new Date(now.getTime() + passwordResetAuthorizationLifetimeMs);
}
