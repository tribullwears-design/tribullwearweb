import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createGatewayOrder,
  getRazorpayConfigurationStatus,
  getRazorpayKeyId,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "./razorpayService.js";

const originalKeyId = process.env.RAZORPAY_KEY_ID;
const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

afterEach(() => {
  if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
  else process.env.RAZORPAY_KEY_ID = originalKeyId;
  if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
  else process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
  if (originalWebhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
  else process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
});

describe("Razorpay service", () => {
  it("reports only whether required variables are present", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_public";
    process.env.RAZORPAY_KEY_SECRET = "server-only-test-secret";
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    expect(getRazorpayConfigurationStatus()).toEqual({
      keyIdPresent: true,
      keySecretPresent: true,
      webhookSecretPresent: false,
    });
  });

  it("identifies missing server credentials without exposing their values", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    expect(() => getRazorpayKeyId()).toThrow("Missing RAZORPAY_KEY_ID");
    await expect(createGatewayOrder(100, "receipt"))
      .rejects.toThrow("Missing RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET");
  });

  it("requires the minimum amount in paise before contacting the provider", async () => {
    await expect(createGatewayOrder(99, "receipt")).rejects.toMatchObject({ status: 400 });
  });

  it("verifies a checkout signature with HMAC-SHA256 and rejects tampering", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_public";
    process.env.RAZORPAY_KEY_SECRET = "server-only-test-secret";
    const orderId = "order_test123";
    const paymentId = "pay_test123";
    const signature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(verifyPaymentSignature(orderId, paymentId, signature)).toBe(true);
    expect(verifyPaymentSignature(orderId, paymentId, "0".repeat(64))).toBe(false);
  });

  it("verifies webhook signatures with the dedicated webhook secret and exact raw body", () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = "server-only-webhook-secret";
    const body = Buffer.from('{"event":"payment.captured"}');
    const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");

    expect(verifyWebhookSignature(body, signature)).toBe(true);
    expect(verifyWebhookSignature(body, "0".repeat(64))).toBe(false);
  });

  it("rejects a webhook URL when a signing secret is required", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "https://example.test/api/razorpay/webhook";
    expect(() => verifyWebhookSignature(Buffer.from("{}"), "0".repeat(64)))
      .toThrow("must be the signing secret configured in Razorpay");
  });
});
