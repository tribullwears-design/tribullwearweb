import type { Product } from "../../../shared/products";
import { parsePrice, resolveOriginalPrice } from "./productPrice";

type ApiProduct = Omit<Product, "price" | "originalPrice"> & {
  price?: string | number | null;
  sellingPrice?: string | number | null;
  currentPrice?: string | number | null;
  salePrice?: string | number | null;
  offerPrice?: string | number | null;
  discountPrice?: string | number | null;
  originalPrice?: string | number | null;
  mrp?: string | number | null;
  MRP?: string | number | null;
  compareAtPrice?: string | number | null;
  compareAt?: string | number | null;
  oldPrice?: string | number | null;
};
export type ProductWrite = Omit<Product, "price" | "id" | "created" | "sold" | "originalPrice"> & {
  sellingPrice: number;
  originalPrice?: number | null;
  id?: string;
  created?: number;
  sold?: number;
};

export function mapApiProduct(product: ApiProduct): Product {
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
    category: product.category,
    image: product.image,
    created: product.created,
    sold: product.sold,
    price,
    ...(originalPrice === undefined ? {} : { originalPrice }),
  };
}
let cachedProducts: Product[] | undefined;
let productsRequest: Promise<Product[]> | undefined;

async function request<T>(path: string, method: "GET" | "POST" | "PATCH", body?: unknown): Promise<T> {
  const response = await fetch(path, {
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

export async function fetchProducts(): Promise<Product[]> {
  if (cachedProducts) return cachedProducts;
  productsRequest ||= request<ApiProduct[]>("/api/products", "GET").then((products) => products.map(mapApiProduct));
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
