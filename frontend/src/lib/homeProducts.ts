import type { CategoryHierarchy } from "./categoryHierarchy";
import { getEligibleStorefrontProducts, type StorefrontProduct } from "./products";

function compareNewest(first: StorefrontProduct, second: StorefrontProduct) {
  const firstCreated = Number.isFinite(first.created) ? first.created : 0;
  const secondCreated = Number.isFinite(second.created) ? second.created : 0;
  return secondCreated - firstCreated || first.id.localeCompare(second.id);
}

export function getNewArrivals(products: readonly StorefrontProduct[], hierarchy: CategoryHierarchy) {
  return getEligibleStorefrontProducts(products, hierarchy).sort(compareNewest);
}

export function getBestSellingProducts(products: readonly StorefrontProduct[], hierarchy: CategoryHierarchy) {
  const eligibleProducts = getEligibleStorefrontProducts(products, hierarchy);
  const hasSalesData = eligibleProducts.some((product) => Number.isFinite(product.sold) && product.sold > 0);
  return eligibleProducts
    .sort((first, second) => hasSalesData
      ? (second.sold - first.sold || compareNewest(first, second))
      : compareNewest(first, second));
}
