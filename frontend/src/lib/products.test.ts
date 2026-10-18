import { describe, expect, it } from "vitest";
import { getProductIdentifier, mapApiProduct, productHref } from "./products";

describe("storefront product identifiers", () => {
  it("prefers the stable API id and supports legacy Mongo _id responses", () => {
    expect(getProductIdentifier({ id: "saved-product", _id: "legacy-id" })).toBe("saved-product");
    expect(getProductIdentifier({ _id: "legacy-id" })).toBe("legacy-id");
    expect(getProductIdentifier({ _id: { $oid: "507f1f77bcf86cd799439011" } })).toBe("507f1f77bcf86cd799439011");
  });

  it("builds the same detail URL used by homepage and listing cards", () => {
    expect(productHref({ id: "saved-product" })).toBe("/product/saved-product");
    expect(productHref({ id: "product with spaces" })).toBe("/product/product%20with%20spaces");
  });

  it("maps a product without id using its legacy Mongo identifier", () => {
    expect(mapApiProduct({
      _id: { $oid: "507f1f77bcf86cd799439011" },
      name: "Saved product",
      category: "products",
      price: 599,
      image: "/product.png",
    } as never).id).toBe("507f1f77bcf86cd799439011");
  });
});
