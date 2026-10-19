import { randomUUID } from "node:crypto";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { getSessionCustomer } from "./authService.js";
import { buildCheckoutOrder, CheckoutValidationError, prepareCheckoutOrder } from "./checkoutOrderService.js";
import type { OrderDocument } from "./orderStore.js";
import {
  createOrder,
  findOrderByIdempotencyKey,
  findOrderByRazorpayOrderId,
  updateRazorpayPayment,
} from "./orderStore.js";
import {
  createGatewayOrder,
  fetchGatewayPayment,
  getRazorpayKeyId,
  RazorpayConfigurationError,
  RazorpayRequestError,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "./razorpayService.js";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

function sendCheckoutError(res: express.Response, error: unknown) {
  if (error instanceof CheckoutValidationError || error instanceof RazorpayRequestError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error instanceof RazorpayConfigurationError) {
    return res.status(503).json({ error: error.message });
  }
  console.error("Checkout request failed");
  return res.status(500).json({ error: "Unable to complete checkout right now" });
}

function checkoutResponse(order: NonNullable<Awaited<ReturnType<typeof findOrderByIdempotencyKey>>>, keyId: string) {
  if (!order.razorpayOrderId || order.paymentMode !== "razorpay") return null;
  return {
    order_id: order.razorpayOrderId,
    amount: Math.round(order.total * 100),
    currency: "INR",
    key_id: keyId,
    internal_order_id: order.id,
  };
}

function customerFacingOrder(order: OrderDocument) {
  const { customerId: _customerId, ...safeOrder } = order;
  return safeOrder;
}

async function requireCustomer(req: express.Request, res: express.Response) {
  const customer = await getSessionCustomer(req);
  if (!customer?._id) {
    res.status(401).json({ error: "Sign in to continue to checkout" });
    return null;
  }
  return { id: customer._id.toString(), email: customer.email };
}

export function createRazorpayCheckoutRouter() {
  const router = express.Router();

  router.post("/api/create-order", checkoutLimiter, async (req, res) => {
    try {
      const identity = await requireCustomer(req, res);
      if (!identity) return;
      const checkout = await prepareCheckoutOrder(req.body, identity);
      const existing = await findOrderByIdempotencyKey(checkout.idempotencyKey);
      if (existing) {
        if ((existing.customerId || undefined) !== identity?.id) {
          return res.status(409).json({ error: "This checkout request key is already in use" });
        }
        if (existing.paymentMode !== "razorpay" || !existing.razorpayOrderId) {
          return res.status(409).json({ error: "This checkout request key is already in use" });
        }
        if (existing.payment.status !== "Pending") {
          return res.status(409).json({ error: "This checkout order already has a payment result" });
        }
        const keyId = getRazorpayKeyId();
        return res.json(checkoutResponse(existing, keyId));
      }

      const amount = Math.round(checkout.total * 100);
      if (!Number.isSafeInteger(amount) || amount < 100) {
        return res.status(400).json({ error: "Order amount must be at least 100 paise." });
      }
      const gateway = await createGatewayOrder(amount, `tb-${randomUUID()}`);
      if (gateway.order.amount !== amount || gateway.order.currency !== "INR" || !gateway.order.id) {
        return res.status(502).json({ error: "Payment provider returned an invalid order" });
      }
      const order = buildCheckoutOrder(checkout, { method: "razorpay", status: "Pending" }, "razorpay", gateway.order.id);
      try {
        await createOrder(order);
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
          const duplicate = await findOrderByIdempotencyKey(checkout.idempotencyKey);
          if (duplicate) {
            if ((duplicate.customerId || undefined) !== identity?.id) {
              return res.status(409).json({ error: "This checkout request key is already in use" });
            }
            if (duplicate.paymentMode !== "razorpay" || !duplicate.razorpayOrderId) {
              return res.status(409).json({ error: "This checkout request key is already in use" });
            }
            if (duplicate.payment.status !== "Pending") {
              return res.status(409).json({ error: "This checkout order already has a payment result" });
            }
            const response = checkoutResponse(duplicate, gateway.keyId);
            if (response) return res.json(response);
          }
        }
        throw error;
      }
      return res.status(201).json({
        order_id: gateway.order.id,
        amount: gateway.order.amount,
        currency: gateway.order.currency,
        key_id: gateway.keyId,
        internal_order_id: order.id,
      });
    } catch (error) {
      return sendCheckoutError(res, error);
    }
  });

  router.post("/api/verify-payment", checkoutLimiter, async (req, res) => {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body ?? {};
    if (typeof orderId !== "string" || !/^order_[A-Za-z0-9]{1,64}$/.test(orderId)
      || typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]{1,64}$/.test(paymentId)
      || typeof signature !== "string" || !/^[a-fA-F0-9]{64}$/.test(signature)) {
      return res.status(400).json({ error: "Payment verification details are incomplete or invalid" });
    }

    try {
      const order = await findOrderByRazorpayOrderId(orderId);
      if (!order) return res.status(404).json({ error: "Checkout order was not found" });
      const identity = await requireCustomer(req, res);
      if (!identity) return;
      if (order.customerId !== identity.id) {
        return res.status(404).json({ error: "Checkout order was not found" });
      }
      if (!verifyPaymentSignature(orderId, paymentId, signature)) {
        return res.status(400).json({ error: "Payment signature could not be verified" });
      }

      const payment = await fetchGatewayPayment(paymentId);
      if (payment.order_id !== orderId || payment.amount !== Math.round(order.total * 100) || payment.currency !== "INR") {
        return res.status(400).json({ error: "Payment does not match this checkout order" });
      }
      const paymentMethod = typeof payment.method === "string" && /^[a-z_]{1,32}$/i.test(payment.method)
        ? payment.method.toLowerCase()
        : "razorpay";
      if (payment.status === "failed") {
        await updateRazorpayPayment(orderId, paymentId, "Failed", paymentMethod);
        return res.status(409).json({ error: "Razorpay reported that this payment failed. Retry checkout to start a new payment.", paymentFailed: true });
      }
      if (payment.status !== "captured" && payment.status !== "authorized") {
        return res.status(409).json({ error: "Payment has not been authorized by the payment provider" });
      }
      const paymentStatus = payment.status === "captured" ? "Paid" : "Authorized";
      const updatedOrder = await updateRazorpayPayment(orderId, paymentId, paymentStatus, paymentMethod);
      if (!updatedOrder) {
        const currentOrder = await findOrderByRazorpayOrderId(orderId);
        if (!currentOrder || currentOrder.razorpayPaymentId !== paymentId || currentOrder.payment.status !== "Paid") {
          return res.status(409).json({ error: "Checkout order already has a different payment result" });
        }
        return res.json({ verified: true, captured: true, order: customerFacingOrder(currentOrder) });
      }
      return res.json({
        verified: true,
        captured: paymentStatus === "Paid",
        order: customerFacingOrder(updatedOrder),
      });
    } catch (error) {
      return sendCheckoutError(res, error);
    }
  });

  router.post("/api/razorpay/webhook", async (req, res) => {
    const signature = req.get("x-razorpay-signature");
    if (!signature || !req.rawBody) {
      return res.status(400).json({ error: "Webhook signature or raw request body is missing" });
    }
    try {
      if (!verifyWebhookSignature(req.rawBody, signature)) {
        return res.status(400).json({ error: "Webhook signature could not be verified" });
      }
    } catch (error) {
      return sendCheckoutError(res, error);
    }

    const event = req.body as {
      event?: unknown;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };
    if (event?.event !== "payment.captured" && event?.event !== "payment.authorized" && event?.event !== "payment.failed") {
      return res.json({ received: true });
    }
    const payment = event.payload?.payment?.entity;
    const expectedStatus = event.event === "payment.captured" ? "captured" : event.event === "payment.authorized" ? "authorized" : "failed";
    if (!payment || typeof payment.id !== "string" || !/^pay_[A-Za-z0-9]{1,64}$/.test(payment.id)
      || typeof payment.order_id !== "string" || !/^order_[A-Za-z0-9]{1,64}$/.test(payment.order_id)
      || !Number.isSafeInteger(payment.amount) || payment.currency !== "INR" || payment.status !== expectedStatus) {
      return res.status(400).json({ error: "Webhook payment details are invalid" });
    }

    try {
      const order = await findOrderByRazorpayOrderId(payment.order_id);
      if (!order) return res.status(404).json({ error: "Checkout order was not found" });
      if (payment.amount !== Math.round(order.total * 100)) {
        return res.status(400).json({ error: "Webhook payment amount does not match the checkout order" });
      }
      const paymentStatus = expectedStatus === "captured" ? "Paid" : expectedStatus === "authorized" ? "Authorized" : "Failed";
      const paymentMethod = typeof payment.method === "string" && /^[a-z_]{1,32}$/i.test(payment.method)
        ? payment.method.toLowerCase()
        : undefined;
      const updatedOrder = await updateRazorpayPayment(payment.order_id, payment.id, paymentStatus, paymentMethod);
      if (!updatedOrder) {
        const currentOrder = await findOrderByRazorpayOrderId(payment.order_id);
        if (currentOrder?.razorpayPaymentId === payment.id
          && (currentOrder.payment.status === paymentStatus || currentOrder.payment.status === "Paid")) {
          return res.json({ received: true });
        }
        return res.status(409).json({ error: "Checkout order already has a different payment result" });
      }
      return res.json({ received: true });
    } catch (error) {
      return sendCheckoutError(res, error);
    }
  });

  router.post("/api/checkout/cod-orders", checkoutLimiter, (_req, res) => {
    return res.status(410).json({ error: "Cash on Delivery is no longer available for new orders." });
  });
  return router;
}
