import { apiFetch } from "./api";

export type SocialSettings = {
  facebook: string;
  instagram: string;
  pinterest: string;
  whatsapp: string;
  linkedin: string;
};

export type GeneralSettings = {
  storeName: string;
  email: string;
  phone: string;
  currency: "INR";
};

export type MovingNavbarSettings = {
  message: string;
  linkText: string;
  linkUrl: string;
};

export const defaultMovingNavbarSettings: MovingNavbarSettings = {
  message: "100% COTTON.",
  linkText: "SHOP NOW",
  linkUrl: "/products",
};

let cachedMovingNavbarSettings = defaultMovingNavbarSettings;
let movingNavbarRequest: Promise<MovingNavbarSettings> | undefined;

export const defaultSocialSettings: SocialSettings = {
  facebook: "https://www.facebook.com/share/18tqYR5pxD/",
  instagram: "https://instagram.com/tribull.in?obrf=MWdtZG9ycWc0dmVkaQ%3D%3D",
  pinterest: "https://pin.it/5UqZJvyWI",
  whatsapp: "https://wa.me/916385400605",
  linkedin: "",
};

export const defaultGeneralSettings: GeneralSettings = {
  storeName: "Tribull Store",
  email: "",
  phone: "",
  currency: "INR",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || `Settings request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function write<T>(path: string, value: T) {
  return request<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

export function fetchSocialSettings() {
  return request<SocialSettings>("/api/storefront/settings/social", { cache: "no-store" });
}

export function getCachedMovingNavbarSettings() {
  return cachedMovingNavbarSettings;
}

export function fetchMovingNavbarSettings() {
  if (!movingNavbarRequest) {
    movingNavbarRequest = request<MovingNavbarSettings>("/api/storefront/settings/moving-navbar", { cache: "no-store" })
      .then((settings) => {
        cachedMovingNavbarSettings = settings;
        return settings;
      })
      .finally(() => {
        movingNavbarRequest = undefined;
      });
  }
  return movingNavbarRequest;
}

export function fetchAdminMovingNavbarSettings() {
  return request<MovingNavbarSettings>("/api/admin/settings/moving-navbar", { cache: "no-store" });
}

export function saveAdminMovingNavbarSettings(value: MovingNavbarSettings) {
  return write<MovingNavbarSettings>("/api/admin/settings/moving-navbar", value).then((settings) => {
    cachedMovingNavbarSettings = settings;
    window.dispatchEvent(new Event("tribull-moving-navbar-updated"));
    return settings;
  });
}

export function fetchAdminSocialSettings() {
  return request<SocialSettings>("/api/admin/settings/social", { cache: "no-store" });
}

export function saveAdminSocialSettings(value: SocialSettings) {
  return write("/api/admin/settings/social", value);
}

export function fetchAdminGeneralSettings() {
  return request<GeneralSettings>("/api/admin/settings/general", { cache: "no-store" });
}

export function saveAdminGeneralSettings(value: GeneralSettings) {
  return write("/api/admin/settings/general", value);
}

export function fetchFeaturedProductIds() {
  return request<string[]>("/api/storefront/featured-products", { cache: "no-store" });
}

export function fetchAdminFeaturedProductIds() {
  return request<string[]>("/api/admin/settings/featured-products", { cache: "no-store" });
}

export function saveAdminFeaturedProductIds(productIds: string[]) {
  return request<string[]>("/api/admin/settings/featured-products", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds }),
  });
}
