export function getFrequentlyBoughtTogether<T extends { id: string }>(products: T[], currentProductId: string): T[] {
  const currentProduct = products.find((product) => product.id === currentProductId);
  const otherProducts = products.filter((product) => product.id !== currentProductId);
  return [...(currentProduct ? [currentProduct] : []), ...otherProducts].slice(0, 4);
}
