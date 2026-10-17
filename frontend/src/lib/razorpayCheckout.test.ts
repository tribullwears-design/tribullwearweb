import { afterEach, describe, expect, it, vi } from "vitest";
import { getRazorpayPaymentConfig, openRazorpayCheckout } from "./razorpayCheckout";

describe("getRazorpayPaymentConfig", () => {
  it.each([
    ["upi", "UPI"],
    ["card", "Debit / credit card"],
    ["netbanking", "Net banking"],
  ] as const)("restricts checkout to the selected %s payment method", (method, label) => {
    expect(getRazorpayPaymentConfig(method)).toEqual({
      display: {
        blocks: {
          selected: {
            name: label,
            instruments: [{ method }],
          },
        },
        sequence: ["block.selected"],
        preferences: { show_default_blocks: false },
      },
    });
  });

  it("does not treat a failed payment event as a successful checkout", async () => {
    const instance = mockRazorpay();
    const payment = openRazorpayCheckout(checkoutOptions());
    await waitForCheckout();
    instance.fail({ error: { description: "Test payment failed" } });

    await expect(payment).rejects.toThrow("Test payment failed");
  });

  it("rejects a dismissed checkout so it cannot continue to payment verification", async () => {
    const instance = mockRazorpay();
    const payment = openRazorpayCheckout(checkoutOptions());
    await waitForCheckout();
    instance.dismiss();

    await expect(payment).rejects.toThrow("Payment was cancelled");
  });

  it("resolves only when Razorpay returns its payment response", async () => {
    const instance = mockRazorpay();
    const payment = openRazorpayCheckout(checkoutOptions());
    await waitForCheckout();
    const result = {
      razorpay_payment_id: "pay_test123",
      razorpay_order_id: "order_test123",
      razorpay_signature: "a".repeat(64),
    };
    instance.succeed(result);

    await expect(payment).resolves.toEqual(result);
  });
});

afterEach(() => vi.unstubAllGlobals());

function checkoutOptions() {
  return {
    key: "rzp_test_public",
    amount: 10000,
    currency: "INR",
    name: "Tribull",
    description: "Test order",
    order_id: "order_test123",
    prefill: { name: "Test Customer", email: "customer@example.test", contact: "9876543210" },
    theme: { color: "#111111" },
    config: getRazorpayPaymentConfig("upi"),
  };
}

function mockRazorpay() {
  let options: {
    handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
    modal: { ondismiss: () => void };
  } | undefined;
  let failed: ((response: { error?: { description?: string } }) => void) | undefined;
  class MockRazorpay {
    constructor(received: typeof options) {
      options = received;
    }
    on(_event: "payment.failed", handler: NonNullable<typeof failed>) {
      failed = handler;
    }
    open() {}
  }
  vi.stubGlobal("window", { Razorpay: MockRazorpay });
  vi.stubGlobal("document", {});
  return {
    fail: (response: { error?: { description?: string } }) => failed?.(response),
    dismiss: () => options?.modal.ondismiss(),
    succeed: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => options?.handler(response),
  };
}

async function waitForCheckout() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
