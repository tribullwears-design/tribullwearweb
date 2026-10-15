import type { Product } from "../../../shared/products";
import type { CategoryHierarchy } from "./categoryHierarchy";
import { parsePrice, resolveOriginalPrice } from "./productPrice";
import { apiFetch } from "./api";

export type StorefrontProduct = Product & {
  mainCategoryId?: string;
  subcategoryId?: string;
};

type ApiProduct = Omit<StorefrontProduct, "price" | "originalPrice"> & {
  category?: string;
  productType?: string;
  status?: "Active" | "Draft";
  createdAt?: string;
  price?: string | number | null;
  sellingPrice?: string | number | null;
  currentPrice?: string | number | null;
  salePrice?: string | number | null;
  offerPrice?: string | number | null;
  discountPrice?: string | number | null;
  compareAt?: string | number | null;
  originalPrice?: string | number | null;
  mrp?: string | number | null;
  MRP?: string | number | null;
  compareAtPrice?: string | number | null;
  oldPrice?: string | number | null;
};
export type ProductWrite = Omit<Product, "price" | "id" | "created" | "sold" | "originalPrice"> & {
  sellingPrice: number;
  originalPrice?: number | null;
  id?: string;
  created?: number;
  sold?: number;
};

export function mapApiProduct(product: ApiProduct): StorefrontProduct {
  const price = [
    product.sellingPrice,
    product.salePrice,
    product.offerPrice,
    product.discountPrice,
    product.currentPrice,
    product.price,
  ].map(parsePrice).find((value) => value !== undefined);
  if (price === undefined) {
    throw new Error(`Product ${product.id} returned an invalid selling price`);
  }
  const originalPrice = resolveOriginalPrice(product);
  return {
    id: product.id,
    name: product.name,
    category: product.productType || product.category || ("subcategoryId" in product && typeof product.subcategoryId === "string"
      ? product.subcategoryId
      : "mainCategoryId" in product && typeof product.mainCategoryId === "string"
        ? product.mainCategoryId
        : "products"),
    image: product.image,
    created: product.created ?? (typeof product.createdAt === "string" ? Date.parse(product.createdAt) : 0),
    sold: product.sold ?? 0,
    ...(product.mainCategoryId ? { mainCategoryId: product.mainCategoryId } : {}),
    ...(product.subcategoryId ? { subcategoryId: product.subcategoryId } : {}),
    price,
    ...(originalPrice === undefined ? {} : { originalPrice }),
  };
}
let cachedProducts: StorefrontProduct[] | undefined;
let productsRequest: Promise<StorefrontProduct[]> | undefined;

async function request<T>(path: string, method: "GET" | "POST" | "PATCH", body?: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || "Product request failed");
  }
  return response.json() as Promise<T>;
}

export async function fetchProducts(): Promise<StorefrontProduct[]> {
  if (cachedProducts) return cachedProducts;
  productsRequest ||= request<ApiProduct[]>("/api/products", "GET")
    .then((products) => products.filter((product) => product.status !== "Draft").map(mapApiProduct));
  try {
    cachedProducts = await productsRequest;
    return cachedProducts;
  } finally {
    productsRequest = undefined;
  }
}

export async function createProduct(input: ProductWrite): Promise<Product> {
  const created = mapApiProduct(await request<ApiProduct>("/api/products", "POST", input));
  cachedProducts = undefined;
  window.dispatchEvent(new Event("tribull-products-updated"));
  return created;
}

export async function updateProduct(id: string, input: Partial<ProductWrite>): Promise<Product> {
  const updated = mapApiProduct(await request<ApiProduct>(`/api/products/${encodeURIComponent(id)}`, "PATCH", input));
  cachedProducts = undefined;
  window.dispatchEvent(new Event("tribull-products-updated"));
  return updated;
}

export async function refreshProducts(): Promise<Product[]> {
  cachedProducts = undefined;
  return fetchProducts();
}

export function getEligibleStorefrontProducts(
  products: readonly StorefrontProduct[],
  hierarchy: CategoryHierarchy,
): StorefrontProduct[] {
  const visibleSubcategories = new Map(
    hierarchy.main
      .filter((category) => category.isVisible !== false)
      .map((category) => [
        category.value,
        new Set((hierarchy.subcategories[category.value] || [])
          .filter((subcategory) => subcategory.isVisible !== false)
          .map((subcategory) => subcategory.value)),
      ]),
  );
  const seenIds = new Set<string>();

  return products.filter((product) => {
    if (!product.id || seenIds.has(product.id)) return false;
    const subcategories = product.mainCategoryId
      ? visibleSubcategories.get(product.mainCategoryId)
      : undefined;
    if (!subcategories || !product.subcategoryId || !subcategories.has(product.subcategoryId)) return false;
    seenIds.add(product.id);
    return true;
  });
}
