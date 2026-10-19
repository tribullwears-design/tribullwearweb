import express from "express";
import { createServer } from "http";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "path";
import { addSubcategory, CategoryConflictError, createCategory, deleteCategory, editSubcategory, listCategories, removeSubcategory, replaceCategories, setCategoryVisibility, setSubcategoryVisibility, updateCategory } from "./categoryStore.js";
import { deleteBanner, getBanner, listBanners, saveBanner, updateBanner } from "./bannerStore.js";
import { createOrder, findOrderByIdempotencyKey } from "./orderStore.js";
import { adjustProductInventory, createProduct, deleteProduct, getProduct, getProductImage, InsufficientInventoryError, listProducts, updateProduct } from "./productStore.js";
import { AdminSettingsValidationError, getFeaturedProductIds, getGeneralSettings, getSocialSettings, saveFeaturedProductIds, saveGeneralSettings, saveSocialSettings } from "./adminSettingsStore.js";
import { CollectionConflictError, CollectionValidationError, createStoreCollection, deleteStoreCollection, listStoreCollections, updateStoreCollection } from "./collectionStore.js";
import { createOffer, deleteOffer, findActiveCoupon, isOfferKind, listOffers, OfferConflictError, OfferValidationError, updateOffer } from "./marketingStore.js";
import { getDatabase } from "./database.js";
import { createAdminRouter } from "./adminRoutes.js";
import { configureProxyTrust } from "./proxyTrust.js";
import { createRazorpayCheckoutRouter } from "./razorpayRoutes.js";
import { createAdminOrderRouter } from "./orderRoutes.js";
import { createCustomerRouter } from "./customerRoutes.js";
import { logRazorpayConfigurationStatus } from "./razorpayService.js";
import { requireAdminPermission } from "./adminAuth.js";
import { createUploadedVideo, createVideo, deleteVideo, listActiveVideos, listVideos, streamVideoFile, updateVideo } from "./videoStore.js";
import { getEffectiveAdminPermissions } from "./adminPermissions.js";
import { getAdminAnalytics, isDashboardRange } from "./adminAnalyticsStore.js";
import { isCheckoutPaymentMethod, isIndianState, normalizeIndianState } from "../shared/checkout.js";
import { rateLimit } from "express-rate-limit";
import {
  consumePasswordReset,
  clearPasswordOtp,
  findCustomerByEmail,
  incrementPasswordOtpAttempt,
  incrementCustomerTokenVersion,
  isValidCustomerEmail,
  isValidCustomerMobile,
  listCustomersForAdmin,
  normalizeCustomerEmail,
  safeCustomer,
  issuePasswordOtp,
  verifyPasswordOtp,
} from "./authStore.js";
import {
  authenticatePassword,
  clearCustomerSession,
  completeGoogleProfile,
  createPasswordCustomer,
  createPendingGoogleToken,
  createEmailOtp,
  createPasswordResetAuthorization,
  findGoogleCustomer,
  getPasswordResetAuthorization,
  getSessionCustomer,
  hashPassword,
  insertGoogleCustomer,
  issueCustomerSession,
  passwordResetDigest,
  passwordResetAuthorizationExpiry,
  passwordOtpDigest,
  readPendingGoogleToken,
  sendPasswordResetOtpEmail,
  setPasswordResetAuthorization,
  clearPasswordResetAuthorization,
  validateCustomerAuthConfiguration,
  verifyGoogleCredential,
} from "./authService.js";

async function startServer() {
  const envPaths = [
    path.resolve(process.cwd(), "backend", ".env.local"),
    path.resolve(process.cwd(), "backend", ".env.production"),
  ];
  for (const envPath of envPaths) {
    if (existsSync(envPath)) process.loadEnvFile(envPath);
  }
  logRazorpayConfigurationStatus();
  validateCustomerAuthConfiguration();

  const app = express();
  configureProxyTrust(app);
  const server = createServer(app);
  app.use(express.json({
    limit: "10mb",
    verify: (req, _res, buffer) => {
      const request = req as express.Request;
      if (request.path === "/api/razorpay/webhook") request.rawBody = Buffer.from(buffer);
    },
  }));

  const allowedOrigins = new Set(process.env.NODE_ENV === "production" ? [] : [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://192.168.31.155:3000",
    "http://192.168.31.155:3001",
  ]);
  if (process.env.FRONTEND_URL) {
    for (const frontendUrl of process.env.FRONTEND_URL.split(",")) {
      try {
        allowedOrigins.add(new URL(frontendUrl.trim()).origin);
      } catch {
        console.error("An entry in FRONTEND_URL is invalid and will not be allowed by CORS");
      }
    }
  }
  app.use((req, res, next) => {
    const origin = req.get("Origin");
    if (origin && allowedOrigins.has(origin)) {
      res.vary("Origin");
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", req.get("Access-Control-Request-Headers") || "Content-Type, Authorization");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS" && origin) {
      return res.sendStatus(allowedOrigins.has(origin) ? 204 : 403);
    }
    next();
  });
  app.use(createAdminRouter());
  app.use(createRazorpayCheckoutRouter());
  app.use(createAdminOrderRouter());
  app.use(createCustomerRouter());
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });
  const recoveryRequestLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });
  const recoveryVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false });
  app.use("/api/auth", (_req, res, next) => {
    try {
      validateCustomerAuthConfiguration();
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Customer authentication is not configured";
      return res.status(503).json({ error: `Customer authentication is unavailable: ${message}` });
    }
  });
  app.post("/api/auth/register", loginLimiter, async (req, res) => {
    const { name, email, mobile, password } = req.body ?? {};
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ error: "Enter a name between 2 and 80 characters" });
    if (typeof email !== "string" || !isValidCustomerEmail(normalizeCustomerEmail(email))) return res.status(400).json({ error: "Enter a valid email address" });
    if (typeof mobile !== "string" || !isValidCustomerMobile(mobile)) return res.status(400).json({ error: "Enter a valid mobile number" });
    if (typeof password !== "string" || Buffer.byteLength(password, "utf8") < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ error: "Password must be between 8 and 72 bytes" });
    }
    try {
      const customer = await createPasswordCustomer(name, email, mobile, password);
      if (!customer) return res.status(409).json({ error: "An account with this email already exists" });
      issueCustomerSession(res, customer);
      return res.status(201).json({ user: safeCustomer(customer) });
    } catch (error) {
      console.error("Customer registration failed", error);
      return res.status(500).json({ error: "Unable to create your account right now" });
    }
  });
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || !isValidCustomerEmail(normalizeCustomerEmail(email)) || typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Enter a valid email address and password" });
    }
    try {
      const result = await authenticatePassword(email, password);
      if (result.reason === "not-found") return res.status(404).json({ error: "Email not found" });
      if (result.reason === "profile-incomplete") return res.status(403).json({ error: "Complete your account profile before signing in" });
      if (!result.customer) return res.status(401).json({ error: "Invalid email or password" });
      issueCustomerSession(res, result.customer);
      return res.json({ user: safeCustomer(result.customer) });
    } catch (error) {
      console.error("Customer sign-in failed", error);
      return res.status(500).json({ error: "Unable to sign in right now" });
    }
  });
  app.post("/api/auth/google", loginLimiter, async (req, res) => {
    const { credential, flow } = req.body ?? {};
    if (typeof credential !== "string" || !credential) return res.status(400).json({ error: "Google credential is required" });
    if (flow !== "signin" && flow !== "signup") return res.status(400).json({ error: "Choose sign in or sign up to continue with Google" });
    try {
      const profile = await verifyGoogleCredential(credential);
      const linked = await findGoogleCustomer(profile.sub);
      if (linked) {
        if (normalizeCustomerEmail(linked.email) !== profile.email) {
          return res.status(409).json({ error: "This Google account is linked to a different email address." });
        }
        const name = typeof linked.name === "string" && linked.name.trim() ? linked.name.trim() : profile.name;
        const mobile = typeof linked.mobile === "string" && isValidCustomerMobile(linked.mobile)
          ? linked.mobile
          : "";
        const missingFields: ("name" | "mobile")[] = [];
        if (name.trim().length < 2 || name.trim().length > 80) missingFields.push("name");
        if (!mobile) missingFields.push("mobile");

        if (missingFields.length === 0) {
          const customer = linked.isProfileComplete
            ? linked
            : await completeGoogleProfile(profile.sub, name, mobile);
          if (!customer) return res.status(409).json({ error: "Unable to complete your Google profile." });
          issueCustomerSession(res, customer);
          return res.json({ user: safeCustomer(customer) });
        }

        return res.json({
          requiresProfile: true,
          pendingToken: createPendingGoogleToken({ ...profile, name }),
          email: profile.email,
          name,
          missingFields,
        });
      }

      const emailCustomer = await findCustomerByEmail(profile.email);
      if (flow === "signin") {
        return res.status(404).json({ error: "Google account not registered. Please sign up first." });
      }
      if (emailCustomer) {
        return res.status(409).json({ error: "This email already has an account. Sign in with its existing method." });
      }

      const missingFields: ("name" | "mobile")[] = [];
      if (profile.name.length < 2 || profile.name.length > 80) missingFields.push("name");
      missingFields.push("mobile");
      return res.json({
        requiresProfile: true,
        pendingToken: createPendingGoogleToken(profile),
        email: profile.email,
        name: profile.name,
        missingFields,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign-in failed";
      if (message.includes("not configured")) return res.status(503).json({ error: message });
      if (message.includes("Google did not return")) return res.status(401).json({ error: message });
      console.error("Google customer sign-in failed", error);
      return res.status(401).json({ error: "Google sign-in could not be verified" });
    }
  });
  app.post("/api/auth/google/complete-profile", loginLimiter, async (req, res) => {
    const { pendingToken, name, mobile } = req.body ?? {};
    if (typeof pendingToken !== "string") return res.status(400).json({ error: "Google profile token is required" });
    try {
      const profile = readPendingGoogleToken(pendingToken);
      const linked = await findGoogleCustomer(profile.sub);
      if (linked && normalizeCustomerEmail(linked.email) !== profile.email) {
        return res.status(409).json({ error: "This Google account is linked to a different email address." });
      }
      if (!linked && await findCustomerByEmail(profile.email)) {
        return res.status(409).json({ error: "This email already has an account. Sign in with its existing method." });
      }

      const savedName = typeof linked?.name === "string" && linked.name.trim()
        ? linked.name.trim()
        : profile.name;
      const savedMobile = typeof linked?.mobile === "string" && isValidCustomerMobile(linked.mobile)
        ? linked.mobile
        : "";
      const finalName = savedName || (typeof name === "string" ? name.trim() : "");
      const finalMobile = savedMobile || (typeof mobile === "string" ? mobile : "");
      if (finalName.length < 2 || finalName.length > 80) return res.status(400).json({ error: "Enter a name between 2 and 80 characters" });
      if (!isValidCustomerMobile(finalMobile)) return res.status(400).json({ error: "Enter a valid mobile number" });

      let customer = await completeGoogleProfile(profile.sub, finalName, finalMobile);
      if (!customer) customer = await insertGoogleCustomer(profile, finalName, finalMobile);
      if (!customer) {
        const racedCustomer = await findGoogleCustomer(profile.sub);
        if (racedCustomer && normalizeCustomerEmail(racedCustomer.email) === profile.email && racedCustomer.isProfileComplete) {
          customer = racedCustomer;
        } else {
          return res.status(409).json({ error: "This email already has an account. Sign in with its existing method." });
        }
      }
      issueCustomerSession(res, customer);
      return res.json({ user: safeCustomer(customer) });
    } catch (error) {
      if (error instanceof Error && error.name === "JsonWebTokenError") return res.status(401).json({ error: "Google profile session is invalid or expired" });
      console.error("Google profile completion failed", error);
      return res.status(500).json({ error: "Unable to complete your account right now" });
    }
  });
  app.get("/api/auth/me", async (req, res) => {
    try {
      const customer = await getSessionCustomer(req);
      if (!customer) return res.status(401).json({ error: "Not signed in" });
      const admin = customer.adminRole === "admin" ? {
        role: customer.adminTitle || "Admin",
        status: customer.adminStatus || "Active",
        permissions: getEffectiveAdminPermissions(customer.adminTitle || "Admin", customer.adminPermissions),
      } : null;
      return res.json({ user: safeCustomer(customer), admin });
    } catch (error) {
      console.error("Customer session lookup failed", error);
      return res.status(500).json({ error: "Unable to check sign-in status" });
    }
  });
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const customer = await getSessionCustomer(req);
      if (customer?._id) await incrementCustomerTokenVersion(customer._id.toString());
      clearCustomerSession(res);
      return res.sendStatus(204);
    } catch (error) {
      console.error("Customer sign-out failed", error);
      return res.status(500).json({ error: "Unable to sign out right now" });
    }
  });
  const sendPasswordOtp = async (emailInput: unknown, res: express.Response) => {
    clearPasswordResetAuthorization(res);
    if (typeof emailInput !== "string" || !isValidCustomerEmail(normalizeCustomerEmail(emailInput))) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
    const email = normalizeCustomerEmail(emailInput);
    try {
      const customer = await findCustomerByEmail(email);
      if (!customer) return res.status(404).json({ error: "Email not found. Please sign up first." });
      if (!customer._id) return res.status(500).json({ error: "Unable to start password recovery right now" });
      const now = new Date();
      const challenge = createEmailOtp(email);
      const issued = await issuePasswordOtp(
        customer._id,
        email,
        challenge.digest,
        now,
        new Date(now.getTime() + 5 * 60 * 1000),
        new Date(now.getTime() - 60 * 1000),
      );
      if (issued.matchedCount === 0) {
        const secondsRemaining = customer.resetOtpSentAt
          ? Math.max(1, Math.ceil((60_000 - (now.getTime() - customer.resetOtpSentAt.getTime())) / 1000))
          : 60;
        return res.status(429).json({ error: `Please wait ${secondsRemaining} seconds before requesting another OTP`, resendAfterSeconds: secondsRemaining });
      }
      try {
        await sendPasswordResetOtpEmail(customer.email, customer.name, challenge.otp);
      } catch (error) {
        await clearPasswordOtp(customer._id, challenge.digest);
        const message = error instanceof Error ? error.message : "";
        if (message.includes("not configured") || message.includes("placeholders") || message.includes("SMTP_PORT")) {
          return res.status(503).json({ error: message });
        }
        console.error("Password recovery OTP delivery failed", error instanceof Error ? error.name : "Unknown error");
        return res.status(502).json({ error: "Unable to send the OTP email right now" });
      }
      return res.json({ message: "OTP sent to your registered email address", resendAfterSeconds: 60 });
    } catch (error) {
      console.error("Password recovery request failed", error instanceof Error ? error.name : "Unknown error");
      return res.status(500).json({ error: "Unable to start password recovery right now" });
    }
  };

  app.post("/api/auth/request-password-otp", recoveryRequestLimiter, async (req, res) => {
    const { email } = req.body ?? {};
    return sendPasswordOtp(email, res);
  });
  app.post("/api/auth/forgot-password", recoveryRequestLimiter, async (req, res) => {
    const { email } = req.body ?? {};
    return sendPasswordOtp(email, res);
  });
  app.post("/api/auth/resend-password-otp", recoveryRequestLimiter, async (req, res) => {
    const { email } = req.body ?? {};
    return sendPasswordOtp(email, res);
  });
  app.post("/api/auth/verify-password-otp", recoveryVerifyLimiter, async (req, res) => {
    const { email, otp } = req.body ?? {};
    if (typeof email !== "string" || !isValidCustomerEmail(normalizeCustomerEmail(email)) || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: "Enter a valid email address and 6-digit OTP" });
    }
    try {
      const normalizedEmail = normalizeCustomerEmail(email);
      const now = new Date();
      const otpHash = passwordOtpDigest(normalizedEmail, otp);
      const authorization = createPasswordResetAuthorization();
      const customer = await verifyPasswordOtp(
        normalizedEmail,
        otpHash,
        authorization.digest,
        passwordResetAuthorizationExpiry(now),
        now,
      );
      if (customer) {
        setPasswordResetAuthorization(res, authorization.token);
        return res.json({ verified: true });
      }

      const attempts = await incrementPasswordOtpAttempt(normalizedEmail, now);
      if (attempts && (attempts.resetOtpAttempts ?? 0) >= 5) {
        return res.status(429).json({ error: "Too many incorrect OTP attempts. Request a new OTP." });
      }
      const existing = await findCustomerByEmail(normalizedEmail);
      if (existing?.resetOtpVerifiedAt) {
        return res.status(400).json({ error: "This OTP has already been used. Request a new OTP." });
      }
      if (existing?.resetOtpExpiresAt && existing.resetOtpExpiresAt <= now) {
        return res.status(400).json({ error: "This OTP has expired. Request a new OTP." });
      }
      if (existing && (existing.resetOtpAttempts ?? 0) >= 5) {
        return res.status(429).json({ error: "Too many incorrect OTP attempts. Request a new OTP." });
      }
      return res.status(400).json({ error: "The OTP is incorrect. Check the code and try again." });
    } catch (error) {
      console.error("Password recovery OTP verification failed", error instanceof Error ? error.name : "Unknown error");
      return res.status(500).json({ error: "Unable to verify the OTP right now" });
    }
  });
  app.post("/api/auth/reset-password", recoveryVerifyLimiter, async (req, res) => {
    const { password } = req.body ?? {};
    if (typeof password !== "string" || Buffer.byteLength(password, "utf8") < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ error: "Password must be between 8 and 72 bytes" });
    }
    const authorization = getPasswordResetAuthorization(req);
    if (!authorization) return res.status(401).json({ error: "Verify your email OTP before resetting the password" });
    try {
      const customer = await consumePasswordReset(passwordResetDigest(authorization), await hashPassword(password), new Date());
      if (!customer) {
        clearPasswordResetAuthorization(res);
        return res.status(401).json({ error: "Password reset authorization is invalid, expired, or already used" });
      }
      clearCustomerSession(res);
      clearPasswordResetAuthorization(res);
      return res.json({ message: "Password updated. Please sign in again." });
    } catch (error) {
      console.error("Password reset failed", error instanceof Error ? error.name : "Unknown error");
      return res.status(500).json({ error: "Unable to reset your password right now" });
    }
  });

  const sendError = (res: express.Response, error: unknown) => {
    const message = error instanceof Error ? error.message : "Category request failed";
    const status = error instanceof CategoryConflictError || message.includes("Duplicate") ? 409 : message.includes("not found") ? 404 : 500;
    res.status(status).json({ error: message });
  };
  const sendBannerError = (res: express.Response, error: unknown) => {
    const message = error instanceof Error ? error.message : "Banner request failed";
    const status = message.includes("required") || message.includes("supported image") || message.includes("smaller") ? 400 : message.includes("not found") ? 404 : 500;
    res.status(status).json({ error: message });
  };
  const sendOfferError = (res: express.Response, error: unknown) => {
    const message = error instanceof Error ? error.message : "Offer request failed";
    const status = error instanceof OfferConflictError ? 409 : error instanceof OfferValidationError ? 400 : 500;
    res.status(status).json({ error: message });
  };

  app.get("/api/categories", async (_req, res) => {
    try { res.json(await listCategories()); } catch (error) { sendError(res, error); }
  });
  app.put("/api/categories", requireAdminPermission("products", "edit"), async (req, res) => {
    try { res.json(await replaceCategories(req.body)); } catch (error) { sendError(res, error); }
  });
  app.post("/api/categories", requireAdminPermission("products", "edit"), async (req, res) => {
    try { res.status(201).json(await createCategory(req.body)); } catch (error) { sendError(res, error); }
  });
  app.patch("/api/categories/:value", requireAdminPermission("products", "edit"), async (req, res) => {
    try { const category = await updateCategory(req.params.value, req.body); if (!category) return res.status(404).json({ error: "Category not found" }); res.json(category); } catch (error) { sendError(res, error); }
  });
  app.patch("/api/categories/:value/visibility", requireAdminPermission("products", "edit"), async (req, res) => {
    if (!req.body || typeof req.body.isVisible !== "boolean" || Object.keys(req.body).length !== 1) {
      return res.status(400).json({ error: "isVisible must be a boolean" });
    }
    try {
      const category = await setCategoryVisibility(req.params.value, req.body.isVisible);
      if (!category) return res.status(404).json({ error: "Category not found" });
      res.json(category);
    } catch (error) { sendError(res, error); }
  });
  app.delete("/api/categories/:value", requireAdminPermission("products", "edit"), async (req, res) => {
    try { res.json({ deleted: await deleteCategory(req.params.value) }); } catch (error) { sendError(res, error); }
  });
  app.post("/api/categories/:parent/subcategories", requireAdminPermission("products", "edit"), async (req, res) => {
    try { const category = await addSubcategory(req.params.parent, req.body); if (!category) return res.status(404).json({ error: "Parent category not found" }); res.status(201).json(category); } catch (error) { sendError(res, error); }
  });
  app.patch("/api/categories/:parent/subcategories/:value", requireAdminPermission("products", "edit"), async (req, res) => {
    try { const category = await editSubcategory(req.params.parent, req.params.value, req.body); if (!category) return res.status(404).json({ error: "Parent category not found" }); res.json(category); } catch (error) { sendError(res, error); }
  });
  app.patch("/api/categories/:parent/subcategories/:value/visibility", requireAdminPermission("products", "edit"), async (req, res) => {
    if (!req.body || typeof req.body.isVisible !== "boolean" || Object.keys(req.body).length !== 1) {
      return res.status(400).json({ error: "isVisible must be a boolean" });
    }
    try {
      const category = await setSubcategoryVisibility(req.params.parent, req.params.value, req.body.isVisible);
      if (!category) return res.status(404).json({ error: "Subcategory not found" });
      const subcategory = category.subcategories.find((item) => item.value === req.params.value);
      if (!subcategory) return res.status(404).json({ error: "Subcategory not found" });
      res.json(subcategory);
    } catch (error) { sendError(res, error); }
  });
  app.delete("/api/categories/:parent/subcategories/:value", requireAdminPermission("products", "edit"), async (req, res) => {
    try { const category = await removeSubcategory(req.params.parent, req.params.value); if (!category) return res.status(404).json({ error: "Parent category not found" }); res.json(category); } catch (error) { sendError(res, error); }
  });
  app.get("/api/banners", async (_req, res) => {
    try { res.json(await listBanners()); } catch (error) { sendBannerError(res, error); }
  });
  app.get("/api/banners/:categoryId", async (req, res) => {
    try { res.json(await getBanner(req.params.categoryId)); } catch (error) { sendBannerError(res, error); }
  });
  app.post("/api/banners", requireAdminPermission("products", "edit"), async (req, res) => {
    try { res.status(201).json(await saveBanner(req.body?.categoryId, req.body?.image, req.body)); } catch (error) { sendBannerError(res, error); }
  });
  app.put("/api/banners/:id", requireAdminPermission("products", "edit"), async (req, res) => {
    try { res.json(await updateBanner(req.params.id, req.body?.categoryId, req.body?.image, req.body)); } catch (error) { sendBannerError(res, error); }
  });
  app.delete("/api/banners/:id", requireAdminPermission("products", "edit"), async (req, res) => {
    try {
      if (!await deleteBanner(req.params.id)) return res.status(404).json({ error: "Banner not found" });
      res.json({ deleted: true });
    } catch (error) { sendBannerError(res, error);     }
  });
  app.get("/api/storefront/settings/social", async (_req, res) => {
    try { res.json(await getSocialSettings()); } catch (error) { sendError(res, error); }
  });
  app.get("/api/storefront/featured-products", async (_req, res) => {
    try { res.json(await getFeaturedProductIds()); } catch (error) { sendError(res, error); }
  });
  app.get("/api/admin/settings/general", requireAdminPermission("settings", "view"), async (_req, res) => {
    try { res.json(await getGeneralSettings()); } catch (error) { sendError(res, error); }
  });
  app.put("/api/admin/settings/general", requireAdminPermission("settings", "edit"), async (req, res) => {
    try { res.json(await saveGeneralSettings(req.body)); } catch (error) {
      if (error instanceof AdminSettingsValidationError) return res.status(400).json({ error: error.message });
      sendError(res, error);
    }
  });
  app.get("/api/admin/settings/social", requireAdminPermission("content", "view"), async (_req, res) => {
    try { res.json(await getSocialSettings()); } catch (error) { sendError(res, error); }
  });
  app.put("/api/admin/settings/social", requireAdminPermission("content", "edit"), async (req, res) => {
    try { res.json(await saveSocialSettings(req.body)); } catch (error) {
      if (error instanceof AdminSettingsValidationError) return res.status(400).json({ error: error.message });
      sendError(res, error);
    }
  });
  app.get("/api/admin/settings/featured-products", requireAdminPermission("content", "view"), async (_req, res) => {
    try { res.json(await getFeaturedProductIds()); } catch (error) { sendError(res, error); }
  });
  app.put("/api/admin/settings/featured-products", requireAdminPermission("content", "edit"), async (req, res) => {
    try { res.json(await saveFeaturedProductIds(req.body?.productIds)); } catch (error) {
      if (error instanceof AdminSettingsValidationError) return res.status(400).json({ error: error.message });
      sendError(res, error);
    }
  });
  app.get("/api/admin/collections", requireAdminPermission("content", "view"), async (_req, res) => {
    try { res.json(await listStoreCollections()); } catch (error) { sendError(res, error); }
  });
  app.post("/api/admin/collections", requireAdminPermission("content", "edit"), async (req, res) => {
    try { res.status(201).json(await createStoreCollection(req.body)); } catch (error) {
      if (error instanceof CollectionConflictError) return res.status(409).json({ error: error.message });
      if (error instanceof CollectionValidationError) return res.status(400).json({ error: error.message });
      sendError(res, error);
    }
  });
  app.patch("/api/admin/collections/:id", requireAdminPermission("content", "edit"), async (req, res) => {
    try {
      const collection = await updateStoreCollection(req.params.id, req.body);
      if (!collection) return res.status(404).json({ error: "Collection not found" });
      res.json(collection);
    } catch (error) {
      if (error instanceof CollectionConflictError) return res.status(409).json({ error: error.message });
      if (error instanceof CollectionValidationError) return res.status(400).json({ error: error.message });
      sendError(res, error);
    }
  });
  app.delete("/api/admin/collections/:id", requireAdminPermission("content", "edit"), async (req, res) => {
    try {
      if (!await deleteStoreCollection(req.params.id)) return res.status(404).json({ error: "Collection not found" });
      res.json({ deleted: true });
    } catch (error) {
      if (error instanceof CollectionValidationError) return res.status(400).json({ error: error.message });
      sendError(res, error);
    }
  });
  app.get("/api/admin/marketing/:kind", requireAdminPermission("marketing", "view"), async (req, res) => {
    if (!isOfferKind(req.params.kind)) return res.status(400).json({ error: "Offer type is invalid" });
    try { res.json(await listOffers(req.params.kind)); } catch (error) { sendOfferError(res, error); }
  });
  app.post("/api/admin/marketing/:kind", requireAdminPermission("marketing", "edit"), async (req, res) => {
    if (!isOfferKind(req.params.kind)) return res.status(400).json({ error: "Offer type is invalid" });
    try { res.status(201).json(await createOffer(req.params.kind, req.body)); } catch (error) { sendOfferError(res, error); }
  });
  app.patch("/api/admin/marketing/:kind/:id", requireAdminPermission("marketing", "edit"), async (req, res) => {
    if (!isOfferKind(req.params.kind)) return res.status(400).json({ error: "Offer type is invalid" });
    try {
      const offer = await updateOffer(req.params.kind, req.params.id, req.body);
      if (!offer) return res.status(404).json({ error: "Offer not found" });
      res.json(offer);
    } catch (error) { sendOfferError(res, error); }
  });
  app.delete("/api/admin/marketing/:kind/:id", requireAdminPermission("marketing", "edit"), async (req, res) => {
    if (!isOfferKind(req.params.kind)) return res.status(400).json({ error: "Offer type is invalid" });
    try {
      if (!await deleteOffer(req.params.kind, req.params.id)) return res.status(404).json({ error: "Offer not found" });
      res.json({ deleted: true });
    } catch (error) { sendOfferError(res, error); }
  });
  const storefrontProductImageUrl = (id: string, updatedAt?: string, field: "image" | "images" = "image", index?: number) => {
    const params = new URLSearchParams();
    if (updatedAt) params.set("v", updatedAt);
    if (field === "images") {
      params.set("field", field);
      params.set("index", String(index));
    }
    const query = params.size ? `?${params.toString()}` : "";
    return `/api/products/${encodeURIComponent(id)}/image${query}`;
  };

  app.get("/api/products/:id/image", async (req, res) => {
    try {
      const productImages = await getProductImage(req.params.id);
      const field = req.query.field === "images" ? "images" : "image";
      const imageIndex = field === "images" && typeof req.query.index === "string" ? Number(req.query.index) : -1;
      const image = field === "images"
        ? Number.isInteger(imageIndex) && imageIndex >= 0 ? productImages?.images?.[imageIndex] : undefined
        : productImages?.image;
      if (!image || typeof image !== "string") {
        return res.status(404).json({ error: "Product image not found" });
      }
      const imageVersion = typeof req.query.v === "string" ? req.query.v : "";
      const isVersioned = Boolean(productImages?.updatedAt && imageVersion === productImages.updatedAt);
      res.set("Cache-Control", isVersioned ? "public, max-age=31536000, immutable" : "public, max-age=60");
      if (!/^data:/i.test(image)) return res.redirect(302, image);
      const match = image.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
      if (!match) return res.status(415).json({ error: "Product image format is not supported" });
      return res.type(match[1]).send(Buffer.from(match[2], "base64"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Product image request failed";
      return res.status(message.includes("invalid") ? 400 : 500).json({ error: message });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const mainCategory = typeof req.query.mainCategory === "string" ? req.query.mainCategory : undefined;
      const subcategory = typeof req.query.subcategory === "string" ? req.query.subcategory : undefined;
      const productType = typeof req.query.productType === "string" ? req.query.productType : undefined;
      const products = await listProducts(mainCategory, subcategory, productType);
      res.json(products.map((product) => ({
        ...product,
        image: storefrontProductImageUrl(product.id, product.updatedAt),
        ...(product.images ? { images: product.images.map((_image, index) => storefrontProductImageUrl(product.id, product.updatedAt, "images", index)) } : {}),
      })));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Product request failed";
      const status = message.includes("not found") ? 404 : message.includes("required") || message.includes("Invalid") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });
  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await getProduct(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json({
        ...product,
        image: storefrontProductImageUrl(product.id, product.updatedAt),
        ...(product.images ? { images: product.images.map((_image, index) => storefrontProductImageUrl(product.id, product.updatedAt, "images", index)) } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Product request failed";
      res.status(message.includes("invalid") ? 400 : 500).json({ error: message });
    }
  });
  app.get("/api/admin/products", requireAdminPermission("products", "view"), async (_req, res) => {
    try {
      res.json(await listProducts(undefined, undefined, undefined, true));
    } catch (error) {
      sendError(res, error);
    }
  });
  app.get("/api/admin/product-discounts", requireAdminPermission("products", "view"), async (_req, res) => {
    try {
      const now = Date.now();
      res.json((await listOffers("discount")).filter((offer) => offer.isActive && (!offer.startsAt || Date.parse(offer.startsAt) <= now) && (!offer.endsAt || Date.parse(offer.endsAt) > now)));
    } catch (error) { sendOfferError(res, error); }
  });
  app.get("/api/marketing/coupons/:code", async (req, res) => {
    try { const offer = await findActiveCoupon(req.params.code); if (!offer) return res.status(404).json({ error: "Coupon is invalid or inactive" }); res.json(offer); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Coupon validation failed" }); }
  });
  app.get("/api/admin/videos", requireAdminPermission("products", "view"), async (_req, res) => {
    try { res.json(await listVideos()); } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load videos" }); }
  });
  app.post("/api/admin/videos/upload", requireAdminPermission("products", "edit"), express.raw({ type: ["video/mp4", "video/webm", "video/ogg"], limit: "100mb" }), async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: "Select an MP4, WebM, or OGG video" });
      res.status(201).json(await createUploadedVideo(req.get("X-Video-Name"), req.body, req.get("Content-Type")?.split(";", 1)[0]));
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unable to upload video" }); }
  });
  app.get("/api/videos", async (_req, res) => {
    try { res.json(await listActiveVideos()); } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load videos" }); }
  });
  app.get("/api/videos/files/:storageId", async (req, res) => {
    try { if (!await streamVideoFile(req.params.storageId, res)) res.status(404).end(); } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load video" }); }
  });
  app.post("/api/admin/videos", requireAdminPermission("products", "edit"), async (req, res) => {
    try { res.status(201).json(await createVideo(req.body)); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unable to save video" }); }
  });
  app.patch("/api/admin/videos/:id", requireAdminPermission("products", "edit"), async (req, res) => {
    try { const video = await updateVideo(req.params.id, req.body); if (!video) return res.status(404).json({ error: "Video not found" }); res.json(video); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unable to update video" }); }
  });
  app.delete("/api/admin/videos/:id", requireAdminPermission("products", "edit"), async (req, res) => {
    try { if (!await deleteVideo(req.params.id)) return res.status(404).json({ error: "Video not found" }); res.json({ deleted: true }); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Unable to delete video" }); }
  });
  app.get("/api/admin/products/:id", requireAdminPermission("products", "view"), async (req, res) => {
    try {
      const product = await getProduct(req.params.id, true);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Product request failed";
      res.status(message.includes("invalid") ? 400 : 500).json({ error: message });
    }
  });
  app.post("/api/products", requireAdminPermission("products", "edit"), async (req, res) => {
    try { res.status(201).json(await createProduct(req.body)); } catch (error) {
      const message = error instanceof Error ? error.message : "Product request failed";
      const status = message.includes("not found") ? 404 : message.includes("required") || message.includes("valid") || message.includes("Invalid") || message.includes("must be") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });
  app.patch("/api/products/:id", requireAdminPermission("products", "edit"), async (req, res) => {
    try {
      const product = await updateProduct(req.params.id, req.body);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Product request failed";
      const status = message.includes("not found") ? 404 : message.includes("required") || message.includes("valid") || message.includes("Invalid") || message.includes("must be") || message.includes("unsupported") || message.includes("active or does not exist") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });
  app.delete("/api/products/:id", requireAdminPermission("products", "edit"), async (req, res) => {
    try {
      if (!await deleteProduct(req.params.id)) return res.status(404).json({ error: "Product not found" });
      return res.json({ deleted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Product could not be deleted";
      return res.status(message.includes("invalid") ? 400 : 500).json({ error: message });
    }
  });
  app.patch("/api/products/:id/inventory", requireAdminPermission("products", "edit"), async (req, res) => {
    try {
      const product = await adjustProductInventory(req.params.id, req.body?.adjustment);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (error) {
      if (error instanceof InsufficientInventoryError) return res.status(409).json({ error: error.message });
      const message = error instanceof Error ? error.message : "Inventory adjustment failed";
      const status = message.includes("invalid") || message.includes("whole number") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });
  app.get("/api/admin/customers", requireAdminPermission("customers", "view"), async (_req, res) => {
    try {
      res.json(await listCustomersForAdmin());
    } catch (error) {
      sendError(res, error);
    }
  });
  app.get("/api/admin/analytics", requireAdminPermission("analytics", "view"), async (req, res) => {
    const range = req.query.range === undefined ? "Today" : req.query.range;
    if (!isDashboardRange(range)) return res.status(400).json({ error: "Analytics range is invalid" });
    try {
      res.json(await getAdminAnalytics(range));
    } catch (error) {
      sendError(res, error);
    }
  });
  app.post("/api/orders", (_req, res) => {
    return res.status(410).json({ error: "Client-priced order creation is disabled. Use the validated checkout endpoint." });
  });
  app.post("/api/checkout/test-orders", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Test checkout is available only in development" });
    }
    const { idempotencyKey, customer, shippingAddress, items, paymentMethod } = req.body ?? {};
    if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: "A valid checkout request key is required" });
    }
    try {
      const sessionCustomer = await getSessionCustomer(req);
      const customerId = sessionCustomer?._id?.toString();
      const existingOrder = await findOrderByIdempotencyKey(idempotencyKey);
      if (existingOrder) {
        if ((existingOrder.customerId || undefined) !== customerId) {
          return res.status(409).json({ error: "This checkout request key is already in use" });
        }
        const { customerId: _customerId, ...safeOrder } = existingOrder;
        return res.json(safeOrder);
      }

      if (!customer || typeof customer.name !== "string" || customer.name.trim().length < 2 || customer.name.trim().length > 80
        || typeof customer.email !== "string" || !isValidCustomerEmail(normalizeCustomerEmail(customer.email))
        || typeof customer.phone !== "string" || !isValidCustomerMobile(customer.phone)) {
        return res.status(400).json({ error: "Enter a valid name, email address, and mobile number" });
      }
      if (!shippingAddress || typeof shippingAddress.address !== "string" || shippingAddress.address.trim().length < 5
        || (shippingAddress.apartment !== undefined && typeof shippingAddress.apartment !== "string")
        || typeof shippingAddress.city !== "string" || !shippingAddress.city.trim()
        || !isIndianState(shippingAddress.state)
        || typeof shippingAddress.pinCode !== "string" || !/^\d{6}$/.test(shippingAddress.pinCode)
        || typeof shippingAddress.country !== "string" || shippingAddress.country !== "India") {
        return res.status(400).json({ error: "Enter a complete Indian delivery address with a valid 6-digit PIN code" });
      }
      if (!isCheckoutPaymentMethod(paymentMethod)) {
        return res.status(400).json({ error: "Choose one of the simulated test payment methods" });
      }
      if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
        return res.status(400).json({ error: "The cart must contain between 1 and 50 items" });
      }

      const categories = await listCategories();
      const orderItems = [];
      const requestedByProduct = new Map<string, number>();
      for (const item of items) {
        if (!item || typeof item.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(item.id)
          || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99
          || (item.variant !== undefined && (!item.variant || typeof item.variant !== "object" || Array.isArray(item.variant)))) {
          return res.status(400).json({ error: "Cart contains an invalid product or quantity" });
        }
        const product = await getProduct(item.id);
        if (!product) return res.status(404).json({ error: `Product ${item.id} was not found` });
        if (product.status !== "Active") return res.status(409).json({ error: `${product.name} is not currently available` });
        const category = categories.find((entry) => entry.value === product.mainCategoryId);
        const subcategory = category?.subcategories.find((entry) => entry.value === product.subcategoryId);
        if (!category || category.isVisible === false || !subcategory || subcategory.isVisible === false) {
          return res.status(409).json({ error: `${product.name} is no longer available` });
        }
        const size = item.variant?.size;
        const color = item.variant?.color;
        if (size !== undefined && (typeof size !== "string" || !product.sizes.includes(size))) {
          return res.status(400).json({ error: `The selected size for ${product.name} is not available` });
        }
        if (product.sizes.length > 0 && !size) {
          return res.status(400).json({ error: `Select a size for ${product.name}` });
        }
        if (color !== undefined && (typeof color !== "string" || !product.colors.some((entry) => entry.toLowerCase() === color.toLowerCase()))) {
          return res.status(400).json({ error: `The selected colour for ${product.name} is not available` });
        }
        if (product.colors.length > 0 && !color) {
          return res.status(400).json({ error: `Select a colour for ${product.name}` });
        }
        const requestedQuantity = (requestedByProduct.get(product.id) || 0) + item.quantity;
        requestedByProduct.set(product.id, requestedQuantity);
        if (requestedQuantity > product.stock) {
          return res.status(409).json({ error: `Only ${product.stock} units of ${product.name} are available` });
        }
        const variantLabel = [size ? `Size: ${size}` : "", color ? `Colour: ${color}` : ""].filter(Boolean).join(" / ");
        orderItems.push({
          id: product.id,
          name: product.name,
          price: product.price,
          originalPrice: product.compareAt ?? undefined,
          image: product.image,
          quantity: item.quantity,
          ...(variantLabel ? { variant: variantLabel } : {}),
          lineTotal: product.price * item.quantity,
        });
      }

      const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const orderId = `TB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const order = {
        id: orderId,
        idempotencyKey,
        ...(customerId ? { customerId } : {}),
        customer: {
          name: customer.name.trim(),
          email: normalizeCustomerEmail(customer.email),
          phone: customer.phone.trim(),
        },
        shippingAddress: {
          address: shippingAddress.address.trim(),
          apartment: typeof shippingAddress.apartment === "string" ? shippingAddress.apartment.trim() : "",
          city: shippingAddress.city.trim(),
          state: normalizeIndianState(shippingAddress.state),
          pinCode: shippingAddress.pinCode,
          country: "India",
          recipientName: customer.name.trim(),
          phone: customer.phone.trim(),
        },
        items: orderItems,
        subtotal,
        shipping: 0,
        discount: 0,
        total: subtotal,
        payment: { method: paymentMethod, status: "Simulated" },
        paymentMode: "test" as const,
        status: "Pending" as const,
      };
      try {
        const createdOrder = await createOrder(order);
        const { customerId: _customerId, ...safeOrder } = createdOrder;
        return res.status(201).json(safeOrder);
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
          const duplicate = await findOrderByIdempotencyKey(idempotencyKey);
          if (duplicate && (duplicate.customerId || undefined) !== customerId) {
            return res.status(409).json({ error: "This checkout request key is already in use" });
          }
          if (duplicate) {
            const { customerId: _customerId, ...safeOrder } = duplicate;
            return res.json(safeOrder);
          }
        }
        throw error;
      }
    } catch (error) {
      console.error("Test checkout order creation failed", error);
      return res.status(500).json({ error: "Unable to place the test order right now" });
    }
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });
  app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path !== "/api" && !req.path.startsWith("/api/")) return next(error);

    const errorStatus = typeof error === "object" && error !== null && "status" in error
      ? error.status
      : undefined;
    const status = typeof errorStatus === "number" && errorStatus >= 400 && errorStatus <= 599
      ? errorStatus
      : 500;
    if (status >= 500) console.error("API request failed", error);

    const message = status >= 500
      ? "Internal server error"
      : error instanceof SyntaxError
        ? "Invalid JSON request body"
        : error instanceof Error
          ? error.message
          : "Request failed";
    res.status(status).json({ error: message });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  try {
    await getDatabase();
    console.log("MongoDB connection established");
  } catch (error) {
    console.error("MongoDB connection detail:", error instanceof Error ? error.message : error);
    throw new Error("MongoDB connection failed; verify MONGODB_URI, Atlas network access, and the database user");
  }

  const port = Number(process.env.PORT || 5001);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Backend running on port ${port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Backend startup failed");
  process.exitCode = 1;
});
