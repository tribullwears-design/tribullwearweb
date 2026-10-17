import { Router, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { requireAdmin, requireAdminPermission, requireSuperAdmin } from "./adminAuth.js";
import { AdminAccountSettingsError, updateOwnAdminAccountSettings } from "./adminAccountStore.js";
import { getConfiguredAdminLoginEmail, getConfiguredAdminTestEmail } from "./adminLoginConfig.js";
import {
  AdminUserConflictError,
  AdminUserValidationError,
  createAdminUser,
  createDedicatedAdminAccount,
  deactivateDedicatedAdminAccount,
  listDedicatedAdminAccounts,
  listAdminUserRecords,
  listAdminUsers,
  updateDedicatedAdminAccount,
  updateAdminUser,
  type AdminUserActor,
} from "./adminUserStore.js";
import { getEffectiveAdminPermissions } from "./adminPermissions.js";
import { incrementAdminTokenVersion, isValidCustomerEmail, normalizeCustomerEmail, safeCustomer } from "./authStore.js";
import {
  authenticateAdminLoginPassword,
  clearAdminSession,
  getSessionAdmin,
  issueAdminSession,
  validateCustomerAuthConfiguration,
} from "./authService.js";

export const adminLoginRateLimit = {
  windowMs: 15 * 60 * 1000,
  perAccountIpLimit: 8,
  perIpLimit: 30,
} as const;

function adminLoginIpKey(request: Request) {
  return ipKeyGenerator(request.ip || request.socket.remoteAddress || "unknown");
}

function adminLoginAccountIpKey(request: Request) {
  const email = typeof request.body?.email === "string"
    ? normalizeCustomerEmail(request.body.email)
    : "";
  return createHash("sha256")
    .update(`${adminLoginIpKey(request)}\0${email}`)
    .digest("hex");
}

export function createAdminRouter() {
  const router = Router();
  const rateLimitOptions = {
    windowMs: adminLoginRateLimit.windowMs,
    standardHeaders: "draft-8" as const,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_request: Request, response: Response) =>
      response.statusCode !== 401 && response.statusCode !== 403,
  };
  const adminLoginIpLimiter = rateLimit({
    ...rateLimitOptions,
    limit: adminLoginRateLimit.perIpLimit,
    keyGenerator: adminLoginIpKey,
  });
  const adminLoginAccountLimiter = rateLimit({
    ...rateLimitOptions,
    limit: adminLoginRateLimit.perAccountIpLimit,
    keyGenerator: adminLoginAccountIpKey,
  });
  const clearAdminLoginFailures = async (request: Request) => {
    await Promise.all([
      adminLoginIpLimiter.resetKey(adminLoginIpKey(request)),
      adminLoginAccountLimiter.resetKey(adminLoginAccountIpKey(request)),
    ]);
  };

  router.use("/api/admin/auth", (_req, res, next) => {
    try {
      validateCustomerAuthConfiguration();
      getConfiguredAdminLoginEmail();
      getConfiguredAdminTestEmail();
      next();
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : "Admin authentication configuration is invalid";
      return res.status(503).json({ error: `Admin sign-in configuration error: ${diagnostic}` });
    }
  });

  router.post("/api/admin/auth/login", adminLoginIpLimiter, adminLoginAccountLimiter, async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || !isValidCustomerEmail(normalizeCustomerEmail(email)) || typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Enter a valid email address and password" });
    }
    const regularAdminEmail = getConfiguredAdminLoginEmail();
    const testAdminEmail = getConfiguredAdminTestEmail();
    try {
      const result = await authenticateAdminLoginPassword(email, password, regularAdminEmail, testAdminEmail);
      if (!result.customer) {
        const category = result.reason === "ambiguous-account"
          ? "ambiguous_account_match"
          : result.reason === "invalid-password"
            ? "password_mismatch"
            : result.reason === "profile-incomplete"
              ? "account_profile_incomplete"
              : "allowed_account_not_found";
        console.warn("Admin sign-in rejected", { category });
        return res.status(401).json({ error: "Email or password is incorrect" });
      }
      const customer = result.customer;
      if (customer.adminRole !== "admin" || customer.adminStatus === "Inactive" || !customer.adminTitle) {
        return res.status(403).json({ error: "This account is not authorized for admin access" });
      }
      await clearAdminLoginFailures(req);
      issueAdminSession(res, customer, result.source || "user-credentials");
      return res.json({ user: safeCustomer(customer), admin: {
        role: customer.adminTitle,
        status: customer.adminStatus || "Active",
        permissions: getEffectiveAdminPermissions(customer.adminTitle, customer.adminPermissions),
      } });
    } catch (error) {
      console.error("Admin sign-in failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
      return res.status(500).json({ error: "Unable to sign in right now" });
    }
  });

  router.get("/api/admin/auth/me", async (req, res) => {
    try {
      const customer = await getSessionAdmin(req);
      if (!customer) return res.status(401).json({ error: "Not signed in" });
      if (customer.adminRole !== "admin" || customer.adminStatus === "Inactive" || !customer.adminTitle) {
        return res.status(403).json({ error: "This account is not authorized for admin access" });
      }
      return res.json({ user: safeCustomer(customer), admin: {
        role: customer.adminTitle, status: customer.adminStatus || "Active",
        permissions: getEffectiveAdminPermissions(customer.adminTitle, customer.adminPermissions),
      } });
    } catch (error) {
      console.error("Admin session lookup failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
      return res.status(500).json({ error: "Unable to check admin sign-in status" });
    }
  });

  router.post("/api/admin/auth/logout", async (req, res) => {
    try {
      const customer = await getSessionAdmin(req);
      if (customer?._id) {
        await incrementAdminTokenVersion(
          customer._id.toString(),
          customer.adminAccountSource || "user-credentials",
        );
      }
      clearAdminSession(res);
      return res.sendStatus(204);
    } catch (error) {
      console.error("Admin sign-out failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
      return res.status(500).json({ error: "Unable to sign out right now" });
    }
  });

  router.patch("/api/admin/account", requireAdmin, async (req, res) => {
    try {
      const result = await updateOwnAdminAccountSettings(res.locals.adminActor, req.body);
      if (result.passwordChanged) issueAdminSession(res, result.account, result.source);
      return res.json({ user: safeCustomer(result.account) });
    } catch (error) {
      if (error instanceof AdminAccountSettingsError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error("Admin account settings update failed", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return res.status(500).json({ error: "Unable to update account settings right now" });
    }
  });

  router.get("/api/admin/users", requireAdminPermission("settings", "view"), requireAdminPermission("adminUsers", "view"), async (_req, res) => {
    try {
      res.json(await listAdminUsers());
    } catch (error) {
      sendAdminUserError(res, error);
    }
  });
  router.get("/api/admin/users/records", requireSuperAdmin, async (_req, res) => {
    try {
      res.json(await listAdminUserRecords());
    } catch (error) {
      sendAdminUserError(res, error);
    }
  });
  router.get("/api/admin/users/dedicated", requireSuperAdmin, async (_req, res) => {
    try {
      res.json(await listDedicatedAdminAccounts());
    } catch (error) {
      sendAdminUserError(res, error);
    }
  });
  router.post("/api/admin/users", requireAdminPermission("settings", "edit"), requireAdminPermission("adminUsers", "edit"), async (req, res) => {
    try {
      res.status(201).json(await createAdminUser(req.body, res.locals.adminActor as AdminUserActor));
    } catch (error) {
      if (error instanceof AdminUserConflictError) return res.status(409).json({ error: error.message });
      if (error instanceof AdminUserValidationError) return res.status(400).json({ error: error.message });
      sendAdminUserError(res, error);
    }
  });
  router.post("/api/admin/users/dedicated", requireSuperAdmin, async (req, res) => {
    try {
      const account = await createDedicatedAdminAccount(req.body, res.locals.adminActor as AdminUserActor);
      console.info("Dedicated admin account created", { category: "dedicated_admin_created" });
      res.status(201).json(account);
    } catch (error) {
      if (error instanceof AdminUserConflictError) return res.status(409).json({ error: error.message });
      if (error instanceof AdminUserValidationError) return res.status(400).json({ error: error.message });
      sendAdminUserError(res, error);
    }
  });
  router.patch("/api/admin/users/dedicated/:id", requireSuperAdmin, async (req, res) => {
    try {
      const user = await updateDedicatedAdminAccount(req.params.id, req.body, res.locals.adminActor as AdminUserActor);
      if (!user) return res.status(404).json({ error: "Dedicated admin account not found" });
      console.info("Dedicated admin account updated", { category: "dedicated_admin_updated" });
      res.json(user);
    } catch (error) {
      if (error instanceof AdminUserConflictError) return res.status(409).json({ error: error.message });
      if (error instanceof AdminUserValidationError) return res.status(400).json({ error: error.message });
      sendAdminUserError(res, error);
    }
  });
  router.delete("/api/admin/users/dedicated/:id", requireSuperAdmin, async (req, res) => {
    try {
      const user = await deactivateDedicatedAdminAccount(req.params.id, res.locals.adminActor as AdminUserActor);
      if (!user) return res.status(404).json({ error: "Dedicated admin account not found" });
      console.info("Dedicated admin account deactivated", { category: "dedicated_admin_deactivated" });
      res.json(user);
    } catch (error) {
      if (error instanceof AdminUserConflictError) return res.status(409).json({ error: error.message });
      if (error instanceof AdminUserValidationError) return res.status(400).json({ error: error.message });
      sendAdminUserError(res, error);
    }
  });
  router.patch("/api/admin/users/:id", requireAdminPermission("settings", "edit"), requireAdminPermission("adminUsers", "edit"), async (req, res) => {
    try {
      const user = await updateAdminUser(req.params.id, req.body, res.locals.adminActor as AdminUserActor);
      if (!user) return res.status(404).json({ error: "Admin user not found" });
      res.json(user);
    } catch (error) {
      if (error instanceof AdminUserConflictError) return res.status(409).json({ error: error.message });
      if (error instanceof AdminUserValidationError) return res.status(400).json({ error: error.message });
      sendAdminUserError(res, error);
    }
  });

  return router;
}

function sendAdminUserError(response: import("express").Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Admin user request failed";
  response.status(message.includes("Duplicate") ? 409 : message.includes("not found") ? 404 : 500).json({ error: message });
}