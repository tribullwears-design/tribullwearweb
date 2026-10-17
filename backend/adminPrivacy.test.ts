import { describe, expect, it } from "vitest";
import { redactAdminOrderPersonalInformation } from "./adminPrivacy.js";

describe("admin order privacy", () => {
  it("removes customer contact and shipping address from read-only order data", () => {
    const order = {
      id: "TB-123",
      customer: { name: "Customer Name", email: "buyer@example.com", phone: "9876543210" },
      shippingAddress: { address: "1 Main Street", apartment: "Flat 2", city: "Delhi", state: "Delhi", pinCode: "110001", country: "India" },
      total: 1000,
    };
    expect(redactAdminOrderPersonalInformation(order)).toEqual({
      ...order,
      customer: { name: "Restricted", email: "", phone: "" },
      shippingAddress: { address: "", apartment: "", city: "", state: "", pinCode: "", country: "" },
    });
  });
});
