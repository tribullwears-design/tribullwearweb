import { once } from "node:events";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepareCheckoutOrder: vi.fn(),
  buildCheckoutOrder: vi.fn(),
  createOrder: vi.fn(),
  findOrderByIdempotencyKey: vi.fn(),
  findOrderByRazorpayOrderId: vi.fn(),
  updateRazorpayPayment: vi.fn(),
  createGatewayOrder: vi.fn(),
  getRazorpayKeyId: vi.fn(),
  fetchGatewayPayment: vi.fn(),
  verifyPaymentSignature: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  getSessionCustomer: vi.fn(),
}));

vi.mock("./authService.js", () => ({ getSessionCustomer: mocks.getSessionCustomer }));
vi.mock("./checkoutOrderService.js", () => ({
  CheckoutValidationError: class CheckoutValidationError extends Error {
    constructor(message: string, readonly status = 400) {
      super(message);
    }
  },
  prepareCheckoutOrder: mocks.prepareCheckoutOrder,
  buildCheckoutOrder: mocks.buildCheckoutOrder,
}));
vi.mock("./orderStore.js", () => ({
  createOrder: mocks.createOrder,
  findOrderByIdempotencyKey: mocks.findOrderByIdempotencyKey,
  findOrderByRazorpayOrderId: mocks.findOrderByRazorpayOrderId,
  updateRazorpayPayment: mocks.updateRazorpayPayment,
}));
vi.mock("./razorpayService.js", () => ({
  RazorpayConfigurationError: class RazorpayConfigurationError extends Error {},
  RazorpayRequestError: class RazorpayRequestError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  },
  createGatewayOrder: mocks.createGatewayOrder,
  getRazorpayKeyId: mocks.getRazorpayKeyId,
  fetchGatewayPayment: mocks.fetchGatewayPayment,
  verifyPaymentSignature: mocks.verifyPaymentSignature,
  verifyWebhookSignature: mocks.verifyWebhookSignature,
}));

import { createRazorpayCheckoutRouter } from "./razorpayRoutes.js";
import { RazorpayConfigurationError } from "./razorpayService.js";

const checkout = {
  idempotencyKey: "checkout-request-key-12345",
  customer: { name: "Test Customer", email: "customer@example.test", phone: "9876543210" },
  shippingAddress: { address: "10 Test Street", apartment: "", city: "Chennai", state: "Tamil Nadu", pinCode: "600001", country: "India" },
  items: [{ id: "product-1", quantity: 1 }],
  orderItems: [{ id: "product-1", name: "Test shirt", price: 100, image: "/test.png", quantity: 1, lineTotal: 100 }],
  total: 100,
};
const order = {
  id: "TB-20260101-TEST1234",
  idempotencyKey: checkout.idempotencyKey,
  customer: checkout.customer,
  shippingAddress: checkout.shippingAddress,
  items: checkout.orderItems,
  subtotal: 100,
  shipping: 0,
  discount: 0,
  total: 100,
  payment: { method: "razorpay", status: "Pending" },
  paymentMode: "razorpay",
  razorpayOrderId: "order_test123",
  status: "Pending",
  createdAt: "2026-01-01T00:00:00.000Z",
};

let baseUrl = "";
let server: ReturnType<express.Application["listen"]>;
const originalKeyId = process.env.RAZORPAY_KEY_ID;
const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

beforeEach(async () => {
  vi.clearAllMocks();
  process.env.RAZORPAY_KEY_ID = "rzp_test_public";
  mocks.prepareCheckoutOrder.mockResolvedValue({ ...checkout });
  mocks.buildCheckoutOrder.mockReturnValue({ ...order });
  mocks.findOrderByIdempotencyKey.mockResolvedValue(null);
  mocks.findOrderByRazorpayOrderId.mockResolvedValue({ ...order });
  mocks.createOrder.mockImplementation(async (document) => ({ ...document, createdAt: "2026-01-01T00:00:00.000Z" }));
  mocks.createGatewayOrder.mockResolvedValue({
    keyId: "rzp_test_public",
    order: { id: "order_test123", amount: 10000, currency: "INR" },
  });
  mocks.getRazorpayKeyId.mockReturnValue("rzp_test_public");
  mocks.verifyPaymentSignature.mockReturnValue(true);
  mocks.verifyWebhookSignature.mockReturnValue(true);
  mocks.getSessionCustomer.mockResolvedValue(null);
  mocks.fetchGatewayPayment.mockResolvedValue({
    id: "pay_test123",
    order_id: "order_test123",
    amount: 10000,
    currency: "INR",
    method: "upi",
    status: "captured",
  });
  mocks.updateRazorpayPayment.mockResolvedValue({ ...order, payment: { method: "razorpay", status: "Paid" }, razorpayPaymentId: "pay_test123" });
  const app = express();
  app.use(express.json({
    verify: (req, _res, buffer) => {
      if (req.path === "/api/razorpay/webhook") req.rawBody = Buffer.from(buffer);
    },
  }));
  app.use(createRazorpayCheckoutRouter());
  server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
  else process.env.RAZORPAY_KEY_ID = originalKeyId;
  if (originalWebhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
  else process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
});

describe("Razorpay checkout routes", () => {
  it("returns a clear server configuration error without exposing credentials", async () => {
    mocks.createGatewayOrder.mockRejectedValue(
      new RazorpayConfigurationError("Razorpay is not configured on the server. Missing RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET."),
    );
    const response = await fetch(`${baseUrl}/api/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkout: true }),
    });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("Missing RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET");
    expect(JSON.stringify(body)).not.toContain("rzp_test_public");
  });

  it("creates and stores a provider order using the server-computed amount", async () => {
    const response = await fetch(`${baseUrl}/api/create-order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkout: true }) });
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body).toEqual({
      order_id: "order_test123",
      amount: 10000,
      currency: "INR",
      key_id: "rzp_test_public",
      internal_order_id: order.id,
    });
    expect(mocks.createGatewayOrder).toHaveBeenCalledWith(10000, expect.stringMatching(/^tb-/));
    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: checkout.idempotencyKey,
      total: 100,
      paymentMode: "razorpay",
      razorpayOrderId: "order_test123",
    }));
  });

  it("attaches the authenticated server identity to a Razorpay Test Mode order", async () => {
    const identity = { id: "customer-object-id", email: "account@example.test" };
    mocks.getSessionCustomer.mockResolvedValue({ _id: { toString: () => identity.id }, email: identity.email });
    mocks.prepareCheckoutOrder.mockResolvedValue({ ...checkout, customerId: identity.id });
    mocks.buildCheckoutOrder.mockReturnValue({ ...order, customerId: identity.id });

    const response = await fetch(`${baseUrl}/api/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkout: true }),
    });

    expect(response.status).toBe(201);
    expect(mocks.prepareCheckoutOrder).toHaveBeenCalledWith({ checkout: true }, identity);
    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      customerId: identity.id,
      paymentMode: "razorpay",
      payment: { method: "razorpay", status: "Pending" },
    }));
  });

  it("rejects amounts below 100 paise without creating a provider or database order", async () => {
    mocks.prepareCheckoutOrder.mockResolvedValue({ ...checkout, total: 0.99 });
    const response = await fetch(`${baseUrl}/api/create-order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

    expect(response.status).toBe(400);
    expect(mocks.createGatewayOrder).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("returns the existing pending provider order for a duplicate checkout submission", async () => {
    mocks.findOrderByIdempotencyKey.mockResolvedValue({ ...order });
    const response = await fetch(`${baseUrl}/api/create-order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ order_id: "order_test123", amount: 10000, currency: "INR" });
    expect(mocks.createGatewayOrder).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("rejects a concurrent retry if its idempotency record has already been paid", async () => {
    mocks.createOrder.mockRejectedValue({ code: 11000 });
    mocks.findOrderByIdempotencyKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...order,
        payment: { method: "upi", status: "Paid" },
        razorpayPaymentId: "pay_test123",
      });
    const response = await fetch(`${baseUrl}/api/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "This checkout order already has a payment result" });
    expect(mocks.createGatewayOrder).toHaveBeenCalledTimes(1);
  });

  it("does not reopen checkout after an order has already been paid", async () => {
    mocks.findOrderByIdempotencyKey.mockResolvedValue({
      ...order,
      payment: { method: "razorpay", status: "Paid" },
      razorpayPaymentId: "pay_test123",
    });
    const response = await fetch(`${baseUrl}/api/create-order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

    expect(response.status).toBe(409);
    expect(mocks.createGatewayOrder).not.toHaveBeenCalled();
  });

  it("rejects incomplete verification data", async () => {
    const response = await fetch(`${baseUrl}/api/verify-payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(response.status).toBe(400);
    expect(mocks.findOrderByRazorpayOrderId).not.toHaveBeenCalled();
  });

  it("does not reveal or update a customer order through payment verification from another account", async () => {
    mocks.findOrderByRazorpayOrderId.mockResolvedValue({ ...order, customerId: "owner-customer-id" });
    mocks.getSessionCustomer.mockResolvedValue({ _id: { toString: () => "different-customer-id" } });
    const response = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razorpay_order_id: "order_test123", razorpay_payment_id: "pay_test123", razorpay_signature: "a".repeat(64) }),
    });

    expect(response.status).toBe(404);
    expect(mocks.verifyPaymentSignature).not.toHaveBeenCalled();
    expect(mocks.fetchGatewayPayment).not.toHaveBeenCalled();
  });

  it("does not fetch a provider payment or update an order when the signature is invalid", async () => {
    mocks.verifyPaymentSignature.mockReturnValue(false);
    const response = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razorpay_order_id: "order_test123", razorpay_payment_id: "pay_test123", razorpay_signature: "a".repeat(64) }),
    });

    expect(response.status).toBe(400);
    expect(mocks.fetchGatewayPayment).not.toHaveBeenCalled();
    expect(mocks.updateRazorpayPayment).not.toHaveBeenCalled();
  });

  it("persists Paid only after signature, provider order, amount and currency all match", async () => {
    const response = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razorpay_order_id: "order_test123", razorpay_payment_id: "pay_test123", razorpay_signature: "a".repeat(64) }),
    });
    const body = await response.json() as { verified: boolean; captured: boolean; order: { payment: { status: string } } };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ verified: true, captured: true, order: { payment: { status: "Paid" } } });
    expect(mocks.updateRazorpayPayment).toHaveBeenCalledWith("order_test123", "pay_test123", "Paid", "upi");
  });

  it("does not overwrite a completed order with a different successful payment ID", async () => {
    mocks.findOrderByRazorpayOrderId.mockResolvedValue({
      ...order,
      payment: { method: "upi", status: "Paid" },
      razorpayPaymentId: "pay_prior123",
    });
    mocks.updateRazorpayPayment.mockResolvedValue(null);
    const response = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razorpay_order_id: "order_test123", razorpay_payment_id: "pay_test123", razorpay_signature: "a".repeat(64) }),
    });

    expect(response.status).toBe(409);
    expect(mocks.updateRazorpayPayment).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({ error: "Checkout order already has a different payment result" });
  });

  it("persists a failed provider payment as failed and allows a fresh checkout attempt", async () => {
    mocks.fetchGatewayPayment.mockResolvedValue({
      id: "pay_test123",
      order_id: "order_test123",
      amount: 10000,
      currency: "INR",
      method: "upi",
      status: "failed",
    });
    const response = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razorpay_order_id: "order_test123", razorpay_payment_id: "pay_test123", razorpay_signature: "a".repeat(64) }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ paymentFailed: true });
    expect(mocks.updateRazorpayPayment).toHaveBeenCalledWith("order_test123", "pay_test123", "Failed", "upi");
  });

  it("rejects a payment associated with a different provider order without updating the order", async () => {
    mocks.fetchGatewayPayment.mockResolvedValue({ order_id: "order_other", amount: 10000, currency: "INR", status: "captured" });
    const response = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razorpay_order_id: "order_test123", razorpay_payment_id: "pay_test123", razorpay_signature: "a".repeat(64) }),
    });

    expect(response.status).toBe(400);
    expect(mocks.updateRazorpayPayment).not.toHaveBeenCalled();
  });

  it("rejects a provider payment with a different amount without updating the order", async () => {
    mocks.fetchGatewayPayment.mockResolvedValue({ order_id: "order_test123", amount: 9999, currency: "INR", status: "captured" });
    const response = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razorpay_order_id: "order_test123", razorpay_payment_id: "pay_test123", razorpay_signature: "a".repeat(64) }),
    });

    expect(response.status).toBe(400);
    expect(mocks.updateRazorpayPayment).not.toHaveBeenCalled();
  });

  it("does not call an authorized-but-uncaptured payment Paid", async () => {
    mocks.fetchGatewayPayment.mockResolvedValue({
      id: "pay_test123",
      order_id: "order_test123",
      amount: 10000,
      currency: "INR",
      method: "upi",
      status: "authorized",
    });
    mocks.updateRazorpayPayment.mockResolvedValue({ ...order, payment: { method: "razorpay", status: "Authorized" }, razorpayPaymentId: "pay_test123" });
    const response = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razorpay_order_id: "order_test123", razorpay_payment_id: "pay_test123", razorpay_signature: "a".repeat(64) }),
    });
    const body = await response.json() as { verified: boolean; captured: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ verified: true, captured: false, order: expect.any(Object) });
    expect(mocks.updateRazorpayPayment).toHaveBeenCalledWith("order_test123", "pay_test123", "Authorized", "upi");
  });

  it("accepts a signed captured webhook using the exact raw body and updates the matching order", async () => {
    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay_test123", order_id: "order_test123", amount: 10000, currency: "INR", method: "upi", status: "captured" },
        },
      },
    };
    const rawBody = JSON.stringify(payload);
    const response = await fetch(`${baseUrl}/api/razorpay/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-razorpay-signature": "b".repeat(64) },
      body: rawBody,
    });

    expect(response.status).toBe(200);
    expect(mocks.verifyWebhookSignature).toHaveBeenCalledWith(Buffer.from(rawBody), "b".repeat(64));
    expect(mocks.updateRazorpayPayment).toHaveBeenCalledWith("order_test123", "pay_test123", "Paid", "upi");
  });

  it("rejects an invalid webhook signature without changing an order", async () => {
    mocks.verifyWebhookSignature.mockReturnValue(false);
    const response = await fetch(`${baseUrl}/api/razorpay/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-razorpay-signature": "b".repeat(64) },
      body: JSON.stringify({ event: "payment.captured" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.findOrderByRazorpayOrderId).not.toHaveBeenCalled();
    expect(mocks.updateRazorpayPayment).not.toHaveBeenCalled();
  });

  it("acknowledges a duplicate captured webhook without downgrading or reapplying payment", async () => {
    mocks.updateRazorpayPayment.mockResolvedValue(null);
    mocks.findOrderByRazorpayOrderId.mockResolvedValue({
      ...order,
      payment: { method: "razorpay", status: "Paid" },
      razorpayPaymentId: "pay_test123",
    });
    const response = await fetch(`${baseUrl}/api/razorpay/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-razorpay-signature": "b".repeat(64) },
      body: JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_test123", order_id: "order_test123", amount: 10000, currency: "INR", method: "upi", status: "captured" } } },
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updateRazorpayPayment).toHaveBeenCalledWith("order_test123", "pay_test123", "Paid", "upi");
  });

  it("records signed failed-payment webhook events without reporting payment success", async () => {
    const response = await fetch(`${baseUrl}/api/razorpay/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-razorpay-signature": "b".repeat(64) },
      body: JSON.stringify({
        event: "payment.failed",
        payload: { payment: { entity: { id: "pay_test123", order_id: "order_test123", amount: 10000, currency: "INR", method: "upi", status: "failed" } } },
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updateRazorpayPayment).toHaveBeenCalledWith("order_test123", "pay_test123", "Failed", "upi");
  });

  it("records COD as pending collection, not as a collected payment", async () => {
    mocks.buildCheckoutOrder.mockReturnValue({ ...order, payment: { method: "cod", status: "Pending collection" }, paymentMode: "cod" });
    mocks.createOrder.mockImplementation(async (document) => ({ ...document, createdAt: "2026-01-01T00:00:00.000Z" }));
    const response = await fetch(`${baseUrl}/api/checkout/cod-orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const body = await response.json() as { payment: { status: string }; paymentMode: string };

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ payment: { status: "Pending collection" }, paymentMode: "cod" });
  });

  it("attaches the authenticated server identity to a COD order", async () => {
    const identity = { id: "customer-object-id", email: "account@example.test" };
    mocks.getSessionCustomer.mockResolvedValue({ _id: { toString: () => identity.id }, email: identity.email });
    mocks.prepareCheckoutOrder.mockResolvedValue({ ...checkout, customerId: identity.id });
    mocks.buildCheckoutOrder.mockReturnValue({
      ...order,
      customerId: identity.id,
      payment: { method: "cod", status: "Pending collection" },
      paymentMode: "cod",
    });

    const response = await fetch(`${baseUrl}/api/checkout/cod-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkout: true }),
    });

    expect(response.status).toBe(201);
    expect(mocks.prepareCheckoutOrder).toHaveBeenCalledWith({ checkout: true }, identity);
    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      customerId: identity.id,
      paymentMode: "cod",
      payment: { method: "cod", status: "Pending collection" },
    }));
  });

  it("returns the existing COD order for a duplicate submission", async () => {
    mocks.findOrderByIdempotencyKey.mockResolvedValue({
      ...order,
      payment: { method: "cod", status: "Pending collection" },
      paymentMode: "cod",
    });
    const response = await fetch(`${baseUrl}/api/checkout/cod-orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

    expect(response.status).toBe(200);
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
});
