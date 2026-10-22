import { getDiscountPercentage, parsePrice, formatProductPrice } from "../lib/productPrice";
import { useEffect, useState } from "react";
import { fetchProducts, getCachedProducts } from "../lib/products";
import type { Product } from "../../../shared/products";

type ProductPriceProps = {
  sellingPrice?: string | number | null;
  originalPrice?: string | number | null;
  productName?: string;
  className?: string;
};

export default function ProductPrice({ sellingPrice, originalPrice, productName, className = "" }: ProductPriceProps) {
  const [catalogProduct, setCatalogProduct] = useState<Product | undefined>(() => getCachedProducts()
    .find((product) => product.name.trim().toLowerCase() === productName?.trim().toLowerCase()));
  useEffect(() => {
    if (!productName) return;
    let active = true;
    const loadProductPrice = () => {
      void fetchProducts().then((products) => {
        if (!active) return;
        const match = products.find((product) => product.name.trim().toLowerCase() === productName.trim().toLowerCase());
        setCatalogProduct(match);
      }).catch((error: unknown) => {
        console.error("Failed to load original product prices.", error);
      });
    };
    loadProductPrice();
    const syncProductPrices = () => loadProductPrice();
    window.addEventListener("tribull-products-updated", syncProductPrices);
    window.addEventListener("tribull-products-cache-updated", syncProductPrices);
    return () => {
      active = false;
      window.removeEventListener("tribull-products-updated", syncProductPrices);
      window.removeEventListener("tribull-products-cache-updated", syncProductPrices);
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
    </span>
  );
}
