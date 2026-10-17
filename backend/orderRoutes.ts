import { Router } from "express";
import { requireAdminPermission } from "./adminAuth.js";
import type { AdminUserActor } from "./adminUserStore.js";
import { redactAdminOrderPersonalInformation } from "./adminPrivacy.js";
import { listOrders, orderStatuses, updateOrderStatus, type OrderStatus } from "./orderStore.js";

export function createAdminOrderRouter() {
  const router = Router();

  router.get("/api/orders", requireAdminPermission("orders", "view"), async (req, res) => {
    try {
      const orders = await listOrders(typeof req.query.status === "string" ? req.query.status : undefined);
      const actor = res.locals.adminActor as AdminUserActor;
      if (actor.role === "Manager" || actor.role === "Staff") {
        return res.json(orders.map(redactAdminOrderPersonalInformation));
      }
      return res.json(orders);
    } catch {
      return res.status(500).json({ error: "Unable to load orders" });
    }
  });

  router.patch("/api/orders/:id", requireAdminPermission("orders", "edit"), async (req, res) => {
    try {
      const status = req.body?.status;
      if (!orderStatuses.includes(status as OrderStatus)) {
        return res.status(400).json({ error: "Invalid order status" });
      }
      const order = await updateOrderStatus(req.params.id, status);
      if (!order) return res.status(404).json({ error: "Order not found" });
      const { customerId: _customerId, ...safeOrder } = order;
      return res.json(safeOrder);
    } catch {
      return res.status(500).json({ error: "Unable to update order" });
    }
  });

  return router;
}
