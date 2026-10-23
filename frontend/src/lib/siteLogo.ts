import { apiFetch } from "./api";

export const defaultSiteLogo = "/products/logo.png";
export const siteLogoUpdatedEvent = "tribull-site-logo-updated";
const siteLogoUpdatedStorageKey = "tribull-site-logo-updated";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || "Logo request failed");
  }
  return await response.json() as T;
}

export function loadSiteLogo() {
  return request<{ image: string | null }>(`/api/storefront/logo?refresh=${Date.now()}`, { cache: "no-store" });
}

export async function saveSiteLogo(image: string) {
  const saved = await request<{ image: string }>("/api/admin/site-logo", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  window.dispatchEvent(new CustomEvent(siteLogoUpdatedEvent, { detail: saved.image }));
  try {
    window.localStorage.setItem(siteLogoUpdatedStorageKey, String(Date.now()));
  } catch (error) {
    console.error("Could not notify other tabs about the updated logo.", error);
  }
  return saved;
}

export { siteLogoUpdatedStorageKey };
