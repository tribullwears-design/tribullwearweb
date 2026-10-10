import type { OriginalPriceFields } from "./productPrice";
import { getShowcaseProductImage } from "./storefrontProductImage";

export type AllProduct = OriginalPriceFields & {
  id: string;
  name: string;
  price: string;
  image: string;
};

export const allProducts: AllProduct[] = [
  { id: "all-products-round-neck-classic", name: "Round Neck Classic", price: "₹599", image: "/products/front-white.png" },
  { id: "all-products-round-neck-graphic", name: "Round Neck Graphic", price: "₹649", image: "/products/back-black.png" },
  { id: "all-products-daily-oversized-tee", name: "Daily Oversized Tee", price: "₹799", image: "/products/essential-tshirts.png" },
  { id: "all-products-heavyweight-essential", name: "Heavyweight Essential", price: "₹899", image: "/products/flat-white.png" },
  { id: "all-products-mens-shirt", name: "Men's Shirt", price: "₹699", image: "/products/essential-mens-shirt.png" },
  { id: "all-products-acid-wash-oversized", name: "Acid Wash Oversized", price: "₹1,049", image: "/products/essential-oversized.png" },
  { id: "all-products-street-oversized", name: "Street Oversized", price: "₹949", image: "/products/batman.jpg" },
  { id: "all-products-hoodie-essential", name: "Hoodie Essential", price: "₹1,299", image: "/products/essential-hoodies.png" },
  { id: "all-products-washed-tee", name: "Washed Tee", price: "₹999", image: "/products/tomandjerry.jpg" },
  { id: "all-products-premium-oversized", name: "Premium Oversized", price: "₹1,099", image: "/products/hanger-white.png" },
].map((product, index) => ({
  ...product,
  image: getShowcaseProductImage(index),
}));
