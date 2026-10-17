import { describe, expect, it } from "vitest";
import { validateCustomerAddress } from "./customerAddress";

const address = {
  fullName: " Test Customer ",
  phone: "+91 (98765) 43210",
  address: "  10   Test Road ",
  apartment: "",
  city: "  chennai   south ",
  state: "  tAmIl    nAdU ",
  pinCode: "600001",
};

describe("validateCustomerAddress", () => {
  it("normalizes whitespace and accepts lowercase city/state with an optional apartment", () => {
    expect(validateCustomerAddress(address)).toEqual({
      value: {
        fullName: "Test Customer",
        phone: "+91 (98765) 43210",
        address: "10 Test Road",
        apartment: "",
        city: "chennai south",
        state: "Tamil Nadu",
        pinCode: "600001",
      },
      error: "",
    });
  });

  it("returns a specific validation message for the first invalid required field", () => {
    expect(validateCustomerAddress({ ...address, phone: "123" }).error).toBe("Enter a valid phone number with 10 to 15 digits.");
    expect(validateCustomerAddress({ ...address, pinCode: "60001" }).error).toBe("Enter a valid 6-digit PIN code.");
    expect(validateCustomerAddress({ ...address, state: "Tamil Province" }).error).toBe("Enter a valid Indian state or union territory.");
  });

  it("only validates apartment length when an optional apartment value is provided", () => {
    expect(validateCustomerAddress({ ...address, apartment: "  " }).error).toBe("");
    expect(validateCustomerAddress({ ...address, apartment: "a".repeat(121) }).error).toBe("Apartment / building must be 120 characters or fewer.");
  });
});
