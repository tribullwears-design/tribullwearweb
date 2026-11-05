import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("./api", () => ({ apiFetch: mocks.apiFetch }));

import { fetchProducts, getCachedProducts, getProductIdentifier, mapApiProduct, productHref } from "./products";

describe("storefront product identifiers", () => {
  it("does not render a persisted product cache before the API refreshes it", () => {
    const products = [{
      id: "saved-product",
      name: "Saved product",
      image: "/product.png",
      category: "products",
      price: 599,
      created: 0,
      sold: 0,
    }];
    const getItem = vi.fn(() => JSON.stringify({ updatedAt: Date.now(), products }));
    vi.stubGlobal("window", { localStorage: { getItem } });
    try {
      expect(getCachedProducts()).toEqual([]);
      expect(getItem).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("requests the latest product catalog instead of reusing an in-memory result", async () => {
    const response = () => new Response(JSON.stringify([{
      id: "saved-product",
      name: "Saved product",
      category: "products",
      price: 599,
      image: "/latest-product.png",
      status: "Active",
    }]), { status: 200, headers: { "content-type": "application/json" } });
    mocks.apiFetch.mockResolvedValueOnce(response()).mockResolvedValueOnce(response());

    const first = await fetchProducts();
    const second = await fetchProducts();

    expect(first[0]?.image).toBe("/latest-product.png");
    expect(second[0]?.image).toBe("/latest-product.png");
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    expect(mocks.apiFetch).toHaveBeenLastCalledWith("/api/products", {
      cache: "no-store",
      method: "GET",
      headers: undefined,
      body: undefined,
    });
  });

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

  it("preserves inventory from the catalog response for checkout availability", () => {
    expect(mapApiProduct({
      id: "saved-product",
      name: "Saved product",
      category: "products",
      price: 599,
      image: "/product.png",
      stock: 0,
    } as never).stock).toBe(0);
  });

  it("preserves distinct additional product images for cards that support hover views", () => {
    expect(mapApiProduct({
      id: "saved-product",
      name: "Saved product",
      category: "products",
      price: 599,
      image: "/front.png",
      images: ["/front.png", "/back.png"],
    } as never).images).toEqual(["/front.png", "/back.png"]);
  });
});
