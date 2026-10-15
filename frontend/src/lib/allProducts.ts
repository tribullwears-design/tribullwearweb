import type { OriginalPriceFields } from "./productPrice";

export type AllProduct = OriginalPriceFields & {
  id: string;
  name: string;
  category: string;
  price: string;
  image: string;
};
