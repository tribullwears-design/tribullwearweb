import { describe, expect, it } from "vitest";
import { createCheckoutSubmission } from "./checkout";

describe("createCheckoutSubmission", () => {
  it("preserves the selected Indian state and COD method in the order request", () => {
    expect(createCheckoutSubmission({
      idempotencyKey: "checkout-request-123456",
      customer: { name: "Test Customer", email: "test@example.test", phone: "9876543210" },
      shippingAddress: {
        address: "10 Test Street",
        apartment: "Building A",
        city: "Chennai",
        state: "  tamil nadu ",
        pinCode: "600001",
        country: "India",
      },
      paymentMethod: "cod",
      items: [{ id: "product-1", quantity: 2, variant: { size: "M" } }],
    })).toMatchObject({
      shippingAddress: { state: "Tamil Nadu" },
      paymentMethod: "cod",
      items: [{ id: "product-1", quantity: 2 }],
    });
  });

  it("refuses invalid states before a checkout request can be submitted", () => {
    expect(() => createCheckoutSubmission({
      idempotencyKey: "checkout-request-123456",
      customer: { name: "Test Customer", email: "test@example.test", phone: "9876543210" },
      shippingAddress: {
        address: "10 Test Street",
        apartment: "",
        city: "Chennai",
        state: "Not a state",
        pinCode: "600001",
        country: "India",
      },
      paymentMethod: "cod",
      items: [],
    })).toThrow("Select a valid Indian state");
  });
});
