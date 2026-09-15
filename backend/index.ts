import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { addSubcategory, createCategory, deleteCategory, editSubcategory, listCategories, removeSubcategory, replaceCategories, updateCategory } from "./categoryStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "10mb" }));

  const sendError = (res: express.Response, error: unknown) => {
    const message = error instanceof Error ? error.message : "Category request failed";
    const status = message.includes("Duplicate") ? 409 : message.includes("not found") ? 404 : 500;
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
