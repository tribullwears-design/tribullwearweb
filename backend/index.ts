import express from "express";
import { createServer } from "http";
import { existsSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { addSubcategory, CategoryConflictError, createCategory, deleteCategory, editSubcategory, listCategories, removeSubcategory, replaceCategories, updateCategory } from "./categoryStore.js";
import { deleteBanner, getBanner, listBanners, saveBanner, updateBanner } from "./bannerStore.js";
import { createOrder, listOrders, orderStatuses, updateOrderStatus, type OrderStatus } from "./orderStore.js";
import { createProduct, listProducts, updateProduct } from "./productStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const localEnvPath = path.resolve(process.cwd(), "backend", ".env.local");
  if (existsSync(localEnvPath)) process.loadEnvFile(localEnvPath);

  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "10mb" }));

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
  app.post("/api/products", async (req, res) => {
    try { res.status(201).json(await createProduct(req.body)); } catch (error) {
      const message = error instanceof Error ? error.message : "Product request failed";
      const status = message.includes("not found") ? 404 : message.includes("required") || message.includes("valid") || message.includes("Invalid") ? 400 : 500;
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
      const status = message.includes("not found") ? 404 : message.includes("required") ? 400 : 500;
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

  const port = process.env.PORT || 5001;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
