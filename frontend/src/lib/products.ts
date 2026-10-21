import type { Product } from "../../../shared/products";
import type { CategoryHierarchy } from "./categoryHierarchy";
import { parsePrice, resolveOriginalPrice } from "./productPrice";
import { apiFetch } from "./api";

export type StorefrontProduct = Product & {
  images?: string[];
  stock?: number;
  mainCategoryId?: string;
  subcategoryId?: string;
  newArrival?: boolean;
  bestSelling?: boolean;
  discountOfferId?: string;
  basePrice?: number;
};

export function getProductIdentifier(product: { id?: unknown; _id?: unknown }) {
  if (typeof product.id === "string" && product.id.trim()) return product.id.trim();
  if (typeof product._id === "string" && product._id.trim()) return product._id.trim();
  if (product._id && typeof product._id === "object" && "$oid" in product._id) {
    const objectId = (product._id as { $oid?: unknown }).$oid;
    if (typeof objectId === "string" && objectId.trim()) return objectId.trim();
  }
  return "";
}

export function productHref(product: { id: string }) {
  return `/product/${encodeURIComponent(product.id)}`;
}

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
  newArrival?: boolean;
  bestSelling?: boolean;
  discountOfferId?: string;
  basePrice?: number;
};
export type ProductWrite = Omit<Product, "price" | "id" | "created" | "sold" | "originalPrice"> & {
  sellingPrice: number;
  originalPrice?: number | null;
  id?: string;
  created?: number;
  sold?: number;
};

export function mapApiProduct(product: ApiProduct): StorefrontProduct {
  const id = getProductIdentifier(product);
  if (!id) throw new Error("Product response is missing its stable identifier");
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
    id,
    name: product.name,
    category: product.productType || product.category || ("subcategoryId" in product && typeof product.subcategoryId === "string"
      ? product.subcategoryId
      : "mainCategoryId" in product && typeof product.mainCategoryId === "string"
        ? product.mainCategoryId
        : "products"),
    image: product.image,
    ...(Array.isArray(product.images) ? { images: product.images.filter((image): image is string => typeof image === "string" && Boolean(image.trim())) } : {}),
    created: product.created ?? (typeof product.createdAt === "string" ? Date.parse(product.createdAt) : 0),
    sold: product.sold ?? 0,
    ...(typeof product.stock === "number" ? { stock: product.stock } : {}),
    ...(product.mainCategoryId ? { mainCategoryId: product.mainCategoryId } : {}),
    ...(product.subcategoryId ? { subcategoryId: product.subcategoryId } : {}),
    ...(product.newArrival === true ? { newArrival: true } : {}),
    ...(product.bestSelling === true ? { bestSelling: true } : {}),
    ...(product.discountOfferId ? { discountOfferId: product.discountOfferId } : {}),
    ...(typeof product.basePrice === "number" ? { basePrice: product.basePrice } : {}),
    price,
    ...(originalPrice === undefined ? (typeof product.basePrice === "number" && product.basePrice > price ? { originalPrice: product.basePrice } : {}) : { originalPrice }),
  };
}
const PRODUCT_CACHE_KEY = "tribull-storefront-products";
const PRODUCT_CACHE_TTL = 60_000;

function isStorefrontProductCache(value: unknown): value is StorefrontProduct[] {
  return Array.isArray(value) && value.every((product: unknown) => {
    if (!product || typeof product !== "object") return false;
    return "id" in product && typeof product.id === "string"
      && "name" in product && typeof product.name === "string"
      && "price" in product && typeof product.price === "number"
      && "image" in product && typeof product.image === "string"
      && "category" in product && typeof product.category === "string";
  });
}

function readProductCache() {
  if (typeof window === "undefined") return undefined;
  try {
    const saved = window.sessionStorage.getItem(PRODUCT_CACHE_KEY);
    if (!saved) return undefined;
    const cache = JSON.parse(saved) as { savedAt?: unknown; products?: unknown };
    if (typeof cache.savedAt !== "number" || !isStorefrontProductCache(cache.products)) return undefined;
    return { products: cache.products, savedAt: cache.savedAt };
  } catch {
    return undefined;
  }
}

function saveProductCache(products: StorefrontProduct[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), products }));
  } catch {
    // Keep the in-memory catalog available when browser storage is unavailable.
  }
}

const initialProductCache = readProductCache();
let cachedProducts: StorefrontProduct[] | undefined = initialProductCache?.products;
let cachedProductsAt = initialProductCache?.savedAt || 0;
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

function requestProducts() {
  if (!productsRequest) {
    const requestPromise = request<ApiProduct[]>("/api/products", "GET")
      .then((products) => products.filter((product) => product.status !== "Draft").map(mapApiProduct))
      .then((products) => {
        cachedProducts = products;
        cachedProductsAt = Date.now();
        saveProductCache(products);
        return products;
      });
    const sharedRequest = requestPromise.finally(() => {
      if (productsRequest === sharedRequest) productsRequest = undefined;
    });
    productsRequest = sharedRequest;
  }
  return productsRequest;
}

function invalidateProductCache() {
  cachedProducts = undefined;
  cachedProductsAt = 0;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(PRODUCT_CACHE_KEY);
    } catch {
      // Keep invalidation in memory if browser storage is unavailable.
    }
  }
}

export function getCachedProducts() {
  return cachedProducts || [];
}

export async function fetchProducts(): Promise<StorefrontProduct[]> {
  if (cachedProducts) {
    if (Date.now() - cachedProductsAt > PRODUCT_CACHE_TTL && !productsRequest) {
      void requestProducts()
        .then(() => {
          if (typeof window !== "undefined") window.dispatchEvent(new Event("tribull-products-cache-updated"));
        })
        .catch((error: unknown) => console.error("Could not refresh the cached storefront products.", error));
    }
    return cachedProducts;
  }
  try {
    return await requestProducts();
  } finally {
    productsRequest = undefined;
  }
}

export async function createProduct(input: ProductWrite): Promise<Product> {
  const created = mapApiProduct(await request<ApiProduct>("/api/products", "POST", input));
  invalidateProductCache();
  window.dispatchEvent(new Event("tribull-products-updated"));
  return created;
}

export async function updateProduct(id: string, input: Partial<ProductWrite>): Promise<Product> {
  const updated = mapApiProduct(await request<ApiProduct>(`/api/products/${encodeURIComponent(id)}`, "PATCH", input));
  invalidateProductCache();
  window.dispatchEvent(new Event("tribull-products-updated"));
  return updated;
}

export async function refreshProducts(): Promise<Product[]> {
  invalidateProductCache();
  return requestProducts();
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
