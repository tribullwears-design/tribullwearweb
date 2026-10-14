import type { OriginalPriceFields } from "./productPrice";
import { getShowcaseProductImage } from "./storefrontProductImage";
import { defaultProducts } from "../../../shared/products";

export type AllProduct = OriginalPriceFields & {
  id: string;
  name: string;
  category: string;
  price: string;
  image: string;
};

const productCategories = ["round-neck", "oversized", "acid-oversized", "hoodie"] as const;
const mixedProducts = Array.from({ length: 3 }, (_, round) =>
  productCategories.flatMap((category) => {
    const product = defaultProducts.filter((entry) => entry.category === category)[round];
    return product ? [product] : [];
  }),
).flat();

export const allProducts: AllProduct[] = mixedProducts.map((product, index) => ({
  id: product.id,
  name: product.name,
  category: product.category,
  price: `₹${product.price.toLocaleString("en-IN")}`,
  image: getShowcaseProductImage(index),
}));
