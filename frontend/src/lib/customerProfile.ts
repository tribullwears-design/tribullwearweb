import { apiFetch } from "./api";

export type CustomerProfile = {
  name: string;
  email: string;
  phone: string;
  photo?: string;
};

export type CustomerProfilePatch = {
  name: string;
  phone: string;
  photo?: string | null;
};

export const maxProfilePhotoBytes = 4_000_000;

export function validateProfilePhotoFile(file: Pick<File, "type" | "size">): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxProfilePhotoBytes) {
    return "Choose an image larger than 0 bytes and no larger than 4 MB.";
  }
  return null;
}

export function readProfilePhotoFile(file: File): Promise<string> {
  const validationError = validateProfilePhotoFile(file);
  if (validationError) return Promise.reject(new Error(validationError));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.startsWith(`data:${file.type};base64,`)) {
        reject(new Error("The selected image could not be read. Please choose another file."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("The selected image could not be read. Please try again."));
    reader.onabort = () => reject(new Error("Image reading was cancelled. Please choose the image again."));
    reader.readAsDataURL(file);
  });
}

export async function fetchCustomerProfile(): Promise<CustomerProfile> {
  const response = await apiFetch("/api/customer/profile", { cache: "no-store" });
  const data = await response.json().catch(() => undefined) as { profile?: CustomerProfile; error?: string } | undefined;
  const profile = data?.profile;
  if (!response.ok || !profile || typeof profile.name !== "string" || typeof profile.email !== "string"
    || typeof profile.phone !== "string" || (profile.photo !== undefined && typeof profile.photo !== "string")) {
    throw new Error(data?.error || "Unable to load your saved profile.");
  }
  return profile;
}

export async function saveCustomerProfile(patch: CustomerProfilePatch): Promise<CustomerProfile> {
  const response = await apiFetch("/api/customer/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await response.json().catch(() => undefined) as { error?: string } | undefined;
  if (!response.ok) throw new Error(data?.error || "Unable to save your profile.");
  return fetchCustomerProfile();
}
