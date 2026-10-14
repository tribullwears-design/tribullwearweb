import express from "express";
import { createServer } from "http";
import { existsSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { addSubcategory, CategoryConflictError, createCategory, deleteCategory, editSubcategory, listCategories, removeSubcategory, replaceCategories, updateCategory } from "./categoryStore.js";
import { deleteBanner, getBanner, listBanners, saveBanner, updateBanner } from "./bannerStore.js";
import { createOrder, listOrders, orderStatuses, updateOrderStatus, type OrderStatus } from "./orderStore.js";
import { createProduct, getProduct, listProducts, updateProduct } from "./productStore.js";
import { rateLimit } from "express-rate-limit";
import {
  consumePasswordReset,
  clearPasswordOtp,
  findCustomerByEmail,
  incrementPasswordOtpAttempt,
  incrementCustomerTokenVersion,
  isValidCustomerEmail,
  isValidCustomerMobile,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const envPaths = [
    path.resolve(process.cwd(), "backend", ".env.local"),
    path.resolve(process.cwd(), "backend", ".env.production"),
  ];
  for (const envPath of envPaths) {
    if (existsSync(envPath)) process.loadEnvFile(envPath);
  }
  validateCustomerAuthConfiguration();

  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "10mb" }));

  const allowedOrigins = new Set(process.env.NODE_ENV === "production" ? [] : [
    "http://localhost:3000",
    "http://192.168.31.155:3000",
  ]);
  if (process.env.FRONTEND_URL) {
    try {
      allowedOrigins.add(new URL(process.env.FRONTEND_URL).origin);
    } catch {
      console.error("FRONTEND_URL is invalid; configured-origin CORS is unavailable");
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
    const { credential } = req.body ?? {};
    if (typeof credential !== "string" || !credential) return res.status(400).json({ error: "Google credential is required" });
    try {
      const profile = await verifyGoogleCredential(credential);
      const linked = await findGoogleCustomer(profile.sub);
      if (linked?.isProfileComplete) {
        issueCustomerSession(res, linked);
        return res.json({ user: safeCustomer(linked) });
      }
      if (await findCustomerByEmail(profile.email) && !linked) {
        return res.status(409).json({ error: "This email already has an account. Sign in with its existing method." });
      }
      return res.json({ requiresProfile: true, pendingToken: createPendingGoogleToken(profile), email: profile.email, name: profile.name });
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
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ error: "Enter a name between 2 and 80 characters" });
    if (typeof mobile !== "string" || !isValidCustomerMobile(mobile)) return res.status(400).json({ error: "Enter a valid mobile number" });
    try {
      const profile = readPendingGoogleToken(pendingToken);
      let customer = await completeGoogleProfile(profile.sub, name, mobile);
      if (!customer) customer = await insertGoogleCustomer(profile, name, mobile);
      if (!customer) return res.status(409).json({ error: "This email is already registered" });
      issueCustomerSession(res, customer);
      return res.status(201).json({ user: safeCustomer(customer) });
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
      return res.json({ user: safeCustomer(customer) });
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

  app.get("/api/categories", async (_req, res) => {
    try { res.json(await listCategories()); } catch (error) { sendError(res, error); }
  });
  app.put("/api/categories", async (req, res) => {
    try { res.json(await replaceCategories(req.body)); } catch (error) { sendError(res, error); }
  });
  app.post("/api/categories", async (req, res) => {
    try { res.status(201).json(await createCategory(req.body)); } catch (error) { sendError(res, error); }
  });
  app.patch("/api/categories/:value", async (req, res) => {
    try { const category = await updateCategory(req.params.value, req.body); if (!category) return res.status(404).json({ error: "Category not found" }); res.json(category); } catch (error) { sendError(res, error); }
  });
  app.delete("/api/categories/:value", async (req, res) => {
    try { res.json({ deleted: await deleteCategory(req.params.value) }); } catch (error) { sendError(res, error); }
  });
  app.post("/api/categories/:parent/subcategories", async (req, res) => {
    try { const category = await addSubcategory(req.params.parent, req.body); if (!category) return res.status(404).json({ error: "Parent category not found" }); res.status(201).json(category); } catch (error) { sendError(res, error); }
  });
  app.patch("/api/categories/:parent/subcategories/:value", async (req, res) => {
    try { const category = await editSubcategory(req.params.parent, req.params.value, req.body); if (!category) return res.status(404).json({ error: "Parent category not found" }); res.json(category); } catch (error) { sendError(res, error); }
  });
  app.delete("/api/categories/:parent/subcategories/:value", async (req, res) => {
    try { const category = await removeSubcategory(req.params.parent, req.params.value); if (!category) return res.status(404).json({ error: "Parent category not found" }); res.json(category); } catch (error) { sendError(res, error); }
  });
  app.get("/api/banners", async (_req, res) => {
    try { res.json(await listBanners()); } catch (error) { sendBannerError(res, error); }
  });
  app.get("/api/banners/:categoryId", async (req, res) => {
    try { res.json(await getBanner(req.params.categoryId)); } catch (error) { sendBannerError(res, error); }
  });
  app.post("/api/banners", async (req, res) => {
    try { res.status(201).json(await saveBanner(req.body?.categoryId, req.body?.image)); } catch (error) { sendBannerError(res, error); }
  });
  app.put("/api/banners/:id", async (req, res) => {
    try { res.json(await updateBanner(req.params.id, req.body?.categoryId, req.body?.image)); } catch (error) { sendBannerError(res, error); }
  });
  app.delete("/api/banners/:id", async (req, res) => {
    try {
      if (!await deleteBanner(req.params.id)) return res.status(404).json({ error: "Banner not found" });
      res.json({ deleted: true });
    } catch (error) { sendBannerError(res, error); }
  });
  app.get("/api/products", async (req, res) => {
    try {
      const mainCategory = typeof req.query.mainCategory === "string" ? req.query.mainCategory : undefined;
      const subcategory = typeof req.query.subcategory === "string" ? req.query.subcategory : undefined;
      res.json(await listProducts(mainCategory, subcategory));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Product request failed";
      const status = message.includes("not found") ? 404 : message.includes("required") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });
  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await getProduct(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Product request failed";
      res.status(500).json({ error: message });
    }
  });
  app.post("/api/products", async (req, res) => {
    try { res.status(201).json(await createProduct(req.body)); } catch (error) {
      const message = error instanceof Error ? error.message : "Product request failed";
      const status = message.includes("not found") ? 404 : message.includes("required") || message.includes("valid") || message.includes("Invalid") || message.includes("must be") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });
  app.patch("/api/products/:id", async (req, res) => {
    try {
      const product = await updateProduct(req.params.id, req.body);
      if (!product) return res.status(404).json({ error: "Product not found" });
      res.json(product);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Product request failed";
      const status = message.includes("not found") ? 404 : message.includes("required") || message.includes("valid") || message.includes("Invalid") || message.includes("must be") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });
  app.get("/api/orders", async (req, res) => {
    try { res.json(await listOrders(typeof req.query.status === "string" ? req.query.status : undefined)); } catch (error) { sendError(res, error); }
  });
  app.post("/api/orders", async (req, res) => {
    try { res.status(201).json(await createOrder(req.body)); } catch (error) { sendError(res, error); }
  });
  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const status = req.body?.status;
      if (!orderStatuses.includes(status as OrderStatus)) return res.status(400).json({ error: "Invalid order status" });
      const order = await updateOrderStatus(req.params.id, status);
      if (!order) return res.status(404).json({ error: "Order not found" });
      res.json(order);
    } catch (error) { sendError(res, error); }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = Number(process.env.PORT || 5001);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Backend running on port ${port}`);
  });
}

startServer().catch(console.error);
