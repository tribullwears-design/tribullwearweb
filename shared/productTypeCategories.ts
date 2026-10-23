export type ProductTypeCategory = {
  id: string;
  label: string;
  image: string;
  isVisible: boolean;
};

export const defaultProductTypeCategories: ProductTypeCategory[] = [
  { id: "round-neck", label: "Round Neck", image: "/products/roundneckicon.png", isVisible: true },
  { id: "oversized", label: "Oversized", image: "/products/oversizedicon.png", isVisible: true },
  { id: "acid-oversized", label: "Acid Oversized", image: "/products/acidoverwashicon.png", isVisible: true },
  { id: "hoodie", label: "Hoodie", image: "/products/hoodieicon.png", isVisible: true },
];
