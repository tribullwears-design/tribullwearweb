import { describe, expect, it } from "vitest";
import { formatProductPrice, getDiscountPercentage, parsePrice, resolveOriginalPrice } from "./productPrice";
import { mapApiProduct } from "./products";
import { normalizeProduct, toProductApiRecord } from "../../../backend/productStore";

describe("product price helpers", () => {
  it("calculates savings from selling and original prices", () => {
    expect(getDiscountPercentage(899, 1099)).toBe(18);
    expect(getDiscountPercentage(1500, 2000)).toBe(25);
  });

  it("does not show a discount without a valid higher original price", () => {
    expect(getDiscountPercentage(899, undefined)).toBeUndefined();
    expect(getDiscountPercentage(1099, 899)).toBeUndefined();
    expect(getDiscountPercentage(899, 899)).toBeUndefined();
    expect(getDiscountPercentage(0, 0)).toBeUndefined();
  });

  it("parses formatted prices and formats amounts in Indian numbering", () => {
    expect(parsePrice("₹1,099")).toBe(1099);
    expect(formatProductPrice(1099)).toBe("₹1,099");
  });

  it("maps legacy and alternate API price fields without fabricating MRPs", () => {
    const base = { id: "tee", name: "Test Tee", category: "oversized", image: "/tee.png", created: 1, sold: 0 };
    expect(mapApiProduct({ ...base, salePrice: "₹899", compareAtPrice: "₹1,099" })).toMatchObject({
      price: 899,
      originalPrice: 1099,
    });
    expect(mapApiProduct({ ...base, price: 799 })).toMatchObject({ price: 799 });
    expect(mapApiProduct({ ...base, sellingPrice: 899, mrp: 799 })).toMatchObject({ price: 899, originalPrice: 799 });
    expect(mapApiProduct({ ...base, sellingPrice: 899 })).not.toHaveProperty("originalPrice");
    expect(resolveOriginalPrice({ MRP: "₹1,199" })).toBe(1199);
  });

  it("normalizes legacy database MRP fields into the API originalPrice field", () => {
    const apiProduct = toProductApiRecord(normalizeProduct({
      id: "legacy-tee",
      name: "Legacy Tee",
      category: "oversized",
      image: "/tee.png",
      created: 1,
      sold: 0,
      sellingPrice: 1449,
      mrp: "₹1,999",
    }));

    expect(apiProduct).toMatchObject({ sellingPrice: 1449, originalPrice: 1999 });
    const frontendProduct = mapApiProduct(apiProduct);
    expect(frontendProduct).toMatchObject({ price: 1449, originalPrice: 1999 });
    expect(getDiscountPercentage(frontendProduct.price, frontendProduct.originalPrice)).toBe(28);
  });
});
