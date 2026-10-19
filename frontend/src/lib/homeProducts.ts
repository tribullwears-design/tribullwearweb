import type { CategoryHierarchy } from "./categoryHierarchy";
import { getEligibleStorefrontProducts, type StorefrontProduct } from "./products";

function compareNewest(first: StorefrontProduct, second: StorefrontProduct) {
  const firstCreated = Number.isFinite(first.created) ? first.created : 0;
  const secondCreated = Number.isFinite(second.created) ? second.created : 0;
  return secondCreated - firstCreated || first.id.localeCompare(second.id);
}

export function getNewArrivals(products: readonly StorefrontProduct[], hierarchy: CategoryHierarchy) {
  const eligible = hierarchy.loaded ? getEligibleStorefrontProducts(products, hierarchy) : products;
  return eligible.filter((product) => product.newArrival === true).sort(compareNewest);
}

export function getBestSellingProducts(products: readonly StorefrontProduct[], hierarchy: CategoryHierarchy) {
  const eligibleProducts = hierarchy.loaded ? getEligibleStorefrontProducts(products, hierarchy) : products;
  const flagged = eligibleProducts.filter((product) => product.bestSelling === true);
  return flagged.sort((first, second) => Number.isFinite(second.sold) && Number.isFinite(first.sold)
    ? (second.sold - first.sold || compareNewest(first, second))
    : compareNewest(first, second));
}

export function getAlternateProductImage(product: Pick<StorefrontProduct, "image" | "images">) {
  return product.images?.find((image) => image.trim() && image !== product.image);
}
