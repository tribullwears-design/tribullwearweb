import { describe, expect, it } from "vitest";
import {
  checkoutPaymentMethods,
  getCheckoutPaymentLabel,
  indianStatesAndTerritories,
  isCheckoutPaymentMethod,
  isIndianState,
  normalizeIndianState,
} from "./checkout.js";

describe("checkout options", () => {
  it("includes all Indian states and union territories", () => {
    expect(indianStatesAndTerritories).toHaveLength(36);
    expect(indianStatesAndTerritories).toContain("West Bengal");
    expect(indianStatesAndTerritories).toContain("Dadra and Nagar Haveli and Daman and Diu");
  });

  it("normalizes saved state values and rejects unsupported values", () => {
    expect(normalizeIndianState("  tamil nadu ")).toBe("Tamil Nadu");
    expect(normalizeIndianState("  tAmIl   nAdU ")).toBe("Tamil Nadu");
    expect(isIndianState("Delhi")).toBe(true);
    expect(isIndianState("Not an Indian state")).toBe(false);
  });

  it("exposes only online payment methods and rejects COD", () => {
    expect(checkoutPaymentMethods.map((method) => method.id)).toEqual(["upi", "card", "netbanking"]);
    expect(isCheckoutPaymentMethod("cod")).toBe(false);
    expect(isCheckoutPaymentMethod("cash")).toBe(false);
    expect(getCheckoutPaymentLabel("upi")).toBe("UPI");
  });
});
