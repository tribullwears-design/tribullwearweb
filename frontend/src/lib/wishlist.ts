import { toast } from "sonner";
import { apiFetch } from "./api";

const wishlistKey = "tribull-wishlist";
const guestWishlistKey = "tribull-guest-wishlist";
let customerSession: boolean | null = null;

export function readWishlist() {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(wishlistKey) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveWishlist(productIds: string[], guest: boolean) {
  const uniqueIds = Array.from(new Set(productIds));
  window.localStorage.setItem(wishlistKey, JSON.stringify(uniqueIds));
  if (guest) window.localStorage.setItem(guestWishlistKey, JSON.stringify(uniqueIds));
  window.dispatchEvent(new Event("tribull-wishlist-updated"));
  return uniqueIds;
}

export async function syncCustomerWishlist() {
  const legacy = window.localStorage.getItem(guestWishlistKey);
  try {
    const response = legacy
      ? await apiFetch("/api/customer/wishlist/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: Array.from(new Set(readStoredList(legacy))) }),
      })
      : await apiFetch("/api/customer/wishlist", { cache: "no-store" });
    if (response.status === 401) {
      customerSession = false;
      throw new Error("Sign in again to sync your wishlist.");
    }
    const payload = await response.json().catch(() => undefined) as { productIds?: string[]; discardedCount?: number; error?: string } | undefined;
    if (!response.ok || !payload || !Array.isArray(payload.productIds)) throw new Error(payload?.error || "Unable to sync your wishlist.");
    customerSession = true;
    saveWishlist(payload.productIds, false);
    if (legacy) window.localStorage.removeItem(guestWishlistKey);
    if (payload.discardedCount) toast.info(`${payload.discardedCount} unavailable wishlist item(s) were not transferred.`);
    return payload.productIds;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Unable to sync your wishlist.");
    throw error;
  }
}

export async function toggleWishlistItem(productId: string, add: boolean) {
  if (customerSession === false) {
    const current = readWishlist();
    return saveWishlist(add ? [...current, productId] : current.filter((id) => id !== productId), true);
  }
  try {
    const response = await apiFetch(`/api/customer/wishlist/${encodeURIComponent(productId)}`, {
      method: add ? "PUT" : "DELETE",
    });
    if (response.status === 401) {
      if (customerSession === true) throw new Error("Your sign-in has expired. Sign in again to save wishlist changes.");
      customerSession = false;
      const current = readWishlist();
      return saveWishlist(add ? [...current, productId] : current.filter((id) => id !== productId), true);
    }
    const payload = await response.json().catch(() => undefined) as { productIds?: string[]; error?: string } | undefined;
    if (!response.ok || !payload || !Array.isArray(payload.productIds)) throw new Error(payload?.error || "Unable to update your wishlist.");
    customerSession = true;
    return saveWishlist(payload.productIds, false);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Unable to update your wishlist.");
    throw error;
  }
}

export function restoreGuestWishlist() {
  customerSession = false;
  const saved = window.localStorage.getItem(guestWishlistKey);
  saveWishlist(saved ? readStoredList(saved) : [], true);
}

export function preserveGuestWishlist() {
  customerSession = false;
  const saved = window.localStorage.getItem(guestWishlistKey);
  saveWishlist(saved ? readStoredList(saved) : [], true);
}

function readStoredList(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
