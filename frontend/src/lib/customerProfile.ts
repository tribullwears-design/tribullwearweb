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

async function readCustomerProfileResponse(response: Response, fallbackMessage: string): Promise<CustomerProfile> {
  const data = await response.json().catch(() => undefined) as { profile?: unknown; error?: string } | undefined;
  const profile = data?.profile;
  if (!response.ok || typeof profile !== "object" || profile === null
    || !("name" in profile) || typeof profile.name !== "string"
    || !("email" in profile) || typeof profile.email !== "string"
    || !("phone" in profile) || typeof profile.phone !== "string"
    || ("photo" in profile && profile.photo !== undefined && typeof profile.photo !== "string")) {
    throw new Error(data?.error || fallbackMessage);
  }
  const photo = "photo" in profile && typeof profile.photo === "string" ? profile.photo : undefined;
  return {
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    ...(photo !== undefined ? { photo } : {}),
  };
}

export async function fetchCustomerProfile(): Promise<CustomerProfile> {
  const response = await apiFetch("/api/customer/profile", { cache: "no-store" });
  return readCustomerProfileResponse(response, "Unable to load your saved profile.");
}

export async function saveCustomerProfile(patch: CustomerProfilePatch): Promise<CustomerProfile> {
  const response = await apiFetch("/api/customer/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return readCustomerProfileResponse(response, "Unable to save your profile.");
}
