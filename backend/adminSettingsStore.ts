import type { Collection } from "mongodb";
import { getDatabase } from "./database.js";
import { getProduct } from "./productStore.js";

type SettingKey = "general" | "social" | "featured" | "moving-navbar";
type SettingDocument = { _id: SettingKey; value: unknown; updatedAt: string };

export class AdminSettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminSettingsValidationError";
  }
}

export type GeneralSettings = {
  storeName: string;
  email: string;
  phone: string;
  currency: "INR";
};

export type SocialSettings = {
  facebook: string;
  instagram: string;
  pinterest: string;
  whatsapp: string;
  linkedin: string;
};

export type MovingNavbarSettings = {
  message: string;
  linkText: string;
  linkUrl: string;
};

export const defaultGeneralSettings: GeneralSettings = {
  storeName: "Tribull Store",
  email: "",
  phone: "",
  currency: "INR",
};

export const defaultSocialSettings: SocialSettings = {
  facebook: "https://www.facebook.com/share/18tqYR5pxD/",
  instagram: "https://instagram.com/tribull.in?obrf=MWdtZG9ycWc0dmVkaQ%3D%3D",
  pinterest: "https://pin.it/5UqZJvyWI",
  whatsapp: "https://wa.me/916385400605",
  linkedin: "",
};

export const defaultMovingNavbarSettings: MovingNavbarSettings = {
  message: "100% COTTON.",
  linkText: "SHOP NOW",
  linkUrl: "/products",
};

async function getCollection(): Promise<Collection<SettingDocument>> {
  return (await getDatabase()).collection<SettingDocument>("admin-settings");
}

async function getSetting<T>(key: SettingKey, fallback: T): Promise<T> {
  const setting = await (await getCollection()).findOne({ _id: key });
  return (setting?.value ?? fallback) as T;
}

async function saveSetting<T>(key: SettingKey, value: T): Promise<T> {
  await (await getCollection()).updateOne(
    { _id: key },
    { $set: { value, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
  return value;
}

function settingsRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdminSettingsValidationError("Settings must be an object");
  return value as Record<string, unknown>;
}

export function validateGeneralSettings(value: unknown): GeneralSettings {
  const settings = settingsRecord(value);
  const allowed = ["storeName", "email", "phone", "currency"];
  if (Object.keys(settings).some((key) => !allowed.includes(key))) throw new AdminSettingsValidationError("Unsupported general setting");
  const storeName = typeof settings.storeName === "string" ? settings.storeName.trim() : "";
  const email = typeof settings.email === "string" ? settings.email.trim() : "";
  const phone = typeof settings.phone === "string" ? settings.phone.trim() : "";
  if (!storeName || storeName.length > 80) throw new AdminSettingsValidationError("Store name must be between 1 and 80 characters");
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new AdminSettingsValidationError("Store email is invalid");
  if (phone.length > 30) throw new AdminSettingsValidationError("Store phone must be 30 characters or fewer");
  if (settings.currency !== "INR") throw new AdminSettingsValidationError("Only INR is supported by the store checkout");
  return { storeName, email, phone, currency: "INR" };
}

export function validateSocialSettings(value: unknown): SocialSettings {
  const settings = settingsRecord(value);
  const keys: (keyof SocialSettings)[] = ["facebook", "instagram", "pinterest", "whatsapp", "linkedin"];
  if (Object.keys(settings).some((key) => !keys.includes(key as keyof SocialSettings))) throw new AdminSettingsValidationError("Unsupported social setting");
  const result = {} as SocialSettings;
  for (const key of keys) {
    const url = settings[key];
    if (typeof url !== "string" || url.length > 512) throw new AdminSettingsValidationError(`Social link ${key} must be a URL or empty`);
    if (url) {
      try {
        if (new URL(url).protocol !== "https:") throw new Error();
      } catch {
        throw new AdminSettingsValidationError(`Social link ${key} must use HTTPS`);
      }
    }
    result[key] = url.trim();
  }
  return result;
}

export function validateMovingNavbarSettings(value: unknown): MovingNavbarSettings {
  const settings = settingsRecord(value);
  const keys: (keyof MovingNavbarSettings)[] = ["message", "linkText", "linkUrl"];
  if (Object.keys(settings).some((key) => !keys.includes(key as keyof MovingNavbarSettings))) {
    throw new AdminSettingsValidationError("Unsupported moving navbar setting");
  }
  const message = typeof settings.message === "string" ? settings.message.trim() : "";
  const linkText = typeof settings.linkText === "string" ? settings.linkText.trim() : "";
  const linkUrl = typeof settings.linkUrl === "string" ? settings.linkUrl.trim() : "";
  if (!message || message.length > 100) throw new AdminSettingsValidationError("Announcement text must be between 1 and 100 characters");
  if (!linkText || linkText.length > 40) throw new AdminSettingsValidationError("Announcement link text must be between 1 and 40 characters");
  if (linkUrl.length > 512) throw new AdminSettingsValidationError("Announcement link must be 512 characters or fewer");
  if (!linkUrl.startsWith("/") || linkUrl.startsWith("//")) {
    throw new AdminSettingsValidationError("Announcement link must be an internal store path");
  }
  return { message, linkText, linkUrl };
}

export function validateFeaturedProductIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 24 || !value.every((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id))) {
    throw new AdminSettingsValidationError("Featured products must be a list of up to 24 valid product IDs");
  }
  if (new Set(value).size !== value.length) throw new AdminSettingsValidationError("Featured product IDs must be unique");
  return value;
}

export function getGeneralSettings() {
  return getSetting("general", defaultGeneralSettings);
}

export async function saveGeneralSettings(value: unknown) {
  return saveSetting("general", validateGeneralSettings(value));
}

export function getSocialSettings() {
  return getSetting("social", defaultSocialSettings);
}

export function getMovingNavbarSettings() {
  return getSetting("moving-navbar", defaultMovingNavbarSettings);
}

export async function saveMovingNavbarSettings(value: unknown) {
  return saveSetting("moving-navbar", validateMovingNavbarSettings(value));
}

export async function saveSocialSettings(value: unknown) {
  return saveSetting("social", validateSocialSettings(value));
}

export function getFeaturedProductIds() {
  return getSetting("featured", [] as string[]);
}

export async function saveFeaturedProductIds(value: unknown) {
  const ids = validateFeaturedProductIds(value);
  for (const id of ids) {
    const product = await getProduct(id);
    if (!product || product.status !== "Active") throw new AdminSettingsValidationError(`Featured product ${id} is missing or inactive`);
  }
  return saveSetting("featured", ids);
}
