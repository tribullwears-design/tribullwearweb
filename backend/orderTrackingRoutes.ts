import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { findOrderForTracking } from "./orderStore.js";

const orderTrackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

export function createOrderTrackingRouter() {
  const router = Router();

  router.post("/api/orders/track", orderTrackingLimiter, async (req, res) => {
    const orderId = typeof req.body?.orderId === "string" ? req.body.orderId.trim().toUpperCase() : "";
    const customerName = typeof req.body?.customerName === "string"
      ? req.body.customerName.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
      : "";
    res.setHeader("Cache-Control", "no-store");

    if (!/^[A-Z0-9-]{5,80}$/.test(orderId) || customerName.length < 2 || customerName.length > 80) {
      return res.status(400).json({ error: "Enter a valid order ID and customer name." });
    }

    try {
      const order = await findOrderForTracking(orderId, customerName);
      if (!order) return res.status(404).json({ error: "No order matched those details. Check the order ID and name and try again." });
      return res.json({ order });
    } catch (error) {
      console.error("Order tracking lookup failed", error);
      return res.status(500).json({ error: "Unable to look up this order right now. Please try again." });
    }
  });

  return router;
}
