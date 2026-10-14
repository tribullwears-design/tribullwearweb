import { getDiscountPercentage, parsePrice, formatProductPrice } from "../lib/productPrice";
import { useEffect, useState } from "react";
import { fetchProducts, refreshProducts } from "../lib/products";
import type { Product } from "../../../shared/products";

type ProductPriceProps = {
  sellingPrice?: string | number | null;
  originalPrice?: string | number | null;
  productName?: string;
  className?: string;
};

export default function ProductPrice({ sellingPrice, originalPrice, productName, className = "" }: ProductPriceProps) {
  const [catalogProduct, setCatalogProduct] = useState<Product>();
  useEffect(() => {
    setCatalogProduct(undefined);
    if (!productName) return;
    let active = true;
    const loadProductPrice = (refresh: boolean) => {
      const request = refresh ? refreshProducts() : fetchProducts();
      void request.then((products) => {
        if (!active) return;
        const match = products.find((product) => product.name.trim().toLowerCase() === productName.trim().toLowerCase());
        setCatalogProduct(match);
      }).catch((error: unknown) => {
        console.error("Failed to load original product prices.", error);
      });
    };
    loadProductPrice(false);
    const syncProductPrices = () => loadProductPrice(true);
    window.addEventListener("tribull-products-updated", syncProductPrices);
    return () => {
      active = false;
      window.removeEventListener("tribull-products-updated", syncProductPrices);
    };
  }, [productName]);
  const sellingValue = parsePrice(catalogProduct?.price ?? sellingPrice);
  if (sellingValue === undefined) return null;

  const resolvedOriginalPrice = catalogProduct?.originalPrice ?? originalPrice;
  const discount = getDiscountPercentage(sellingValue, resolvedOriginalPrice);
  const originalValue = parsePrice(resolvedOriginalPrice);

  return (
    <span className={`product-price ${className}`.trim()}>
      {discount !== undefined && originalValue !== undefined && (
        <del className="product-price__original">{formatProductPrice(originalValue)}</del>
      )}
      <strong className="product-price__selling">{formatProductPrice(sellingValue)}</strong>
      {discount !== undefined && <span className="product-price__savings">Save {discount}%</span>}
    </span>
  );
}
