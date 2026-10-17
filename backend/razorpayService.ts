import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";

export class RazorpayConfigurationError extends Error {}
export class RazorpayRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function getRazorpayConfigurationStatus() {
  return {
    keyIdPresent: Boolean(process.env.RAZORPAY_KEY_ID?.trim()),
    keySecretPresent: Boolean(process.env.RAZORPAY_KEY_SECRET?.trim()),
    webhookSecretPresent: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim()),
  };
}

export function logRazorpayConfigurationStatus() {
  console.info("Razorpay configuration variable presence", getRazorpayConfigurationStatus());
}

export function getRazorpayKeyId() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  if (!keyId) throw new RazorpayConfigurationError("Razorpay is not configured on the server. Missing RAZORPAY_KEY_ID.");
  return keyId;
}

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const missing = [
    ...(!keyId ? ["RAZORPAY_KEY_ID"] : []),
    ...(!keySecret ? ["RAZORPAY_KEY_SECRET"] : []),
  ];
  if (missing.length > 0) {
    throw new RazorpayConfigurationError(`Razorpay is not configured on the server. Missing ${missing.join(", ")}.`);
  }
  if (!keyId || !keySecret) throw new RazorpayConfigurationError("Razorpay is not configured on the server.");
  return { keyId, keySecret };
}

function getClient() {
  const credentials = getCredentials();
  return { credentials, client: new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret }) };
}

function providerError(error: unknown): RazorpayRequestError {
  const statusCode = error && typeof error === "object" && "statusCode" in error ? Number(error.statusCode) : NaN;
  if (statusCode === 401) return new RazorpayRequestError("Payment provider authentication failed. Check the server configuration.", 401);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
    return new RazorpayRequestError("Payment provider rejected the checkout request.", statusCode);
  }
  return new RazorpayRequestError("Payment provider is temporarily unavailable.", 502);
}

export async function createGatewayOrder(amount: number, receipt: string) {
  if (!Number.isSafeInteger(amount) || amount < 100) throw new RazorpayRequestError("Order amount must be at least 100 paise.", 400);
  const { credentials, client } = getClient();
  try {
    const order = await client.orders.create({ amount, currency: "INR", receipt });
    return { keyId: credentials.keyId, order };
  } catch (error) {
    throw providerError(error);
  }
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  return verifyHmacSignature(`${orderId}|${paymentId}`, signature, getCredentials().keySecret);
}

export function verifyWebhookSignature(body: Buffer, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new RazorpayConfigurationError("Razorpay webhook is not configured on the server. Missing RAZORPAY_WEBHOOK_SECRET.");
  }
  if (/^https?:\/\//i.test(secret)) {
    throw new RazorpayConfigurationError("RAZORPAY_WEBHOOK_SECRET must be the signing secret configured in Razorpay, not the webhook URL.");
  }
  return verifyHmacSignature(body, signature, secret);
}

function verifyHmacSignature(message: string | Buffer, signature: string, secret: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(message).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

export async function fetchGatewayPayment(paymentId: string) {
  const { client } = getClient();
  try {
    return await client.payments.fetch(paymentId);
  } catch (error) {
    throw providerError(error);
  }
}
