import { apiFetch } from "./api";
import type { CustomerAddressFields } from "./customerAddress";

export type SavedCustomerAddress = CustomerAddressFields & {
  id: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function createEmptyCustomerAddressFields(): CustomerAddressFields {
  return { fullName: "", phone: "", address: "", apartment: "", city: "", state: "", pinCode: "" };
}

export async function fetchCustomerAddresses(): Promise<SavedCustomerAddress[]> {
  const response = await apiFetch("/api/customer/addresses", { cache: "no-store" });
  const data = await response.json().catch(() => undefined) as SavedCustomerAddress[] | { error?: string } | undefined;
  if (!response.ok || !Array.isArray(data)) {
    throw new Error(!Array.isArray(data) && data?.error ? data.error : "Unable to load saved addresses.");
  }
  if (data.some((entry) => !entry || typeof entry.id !== "string" || !entry.id.trim())) {
    throw new Error("Saved address data is missing an address ID. Please contact support.");
  }
  return data;
}

export async function saveCustomerAddress(
  address: CustomerAddressFields,
  id: string | null,
  requestId: string,
  isDefault = false,
): Promise<{ saved: SavedCustomerAddress; addresses: SavedCustomerAddress[] }> {
  const response = await apiFetch(
    id ? `/api/customer/addresses/${encodeURIComponent(id)}` : "/api/customer/addresses",
    {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...address, isDefault, ...(!id ? { requestId } : {}) }),
    },
  );
  const data = await response.json().catch(() => undefined) as SavedCustomerAddress | { error?: string } | undefined;
  if (!response.ok || !data || !("id" in data) || typeof data.id !== "string" || !data.id.trim()) {
    throw new Error(data && "error" in data && data.error ? data.error : "Unable to save this address.");
  }
  const addresses = await fetchCustomerAddresses();
  const saved = addresses.find((entry) => entry.id === data.id);
  if (!saved) throw new Error("The address was saved, but could not be confirmed in your saved address list. Please try again.");
  return { saved, addresses };
}

export async function deleteSavedCustomerAddress(id: string, onConfirmed?: () => void): Promise<SavedCustomerAddress[]> {
  const response = await apiFetch(`/api/customer/addresses/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) {
    const data = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(data?.error || "Unable to delete this address.");
  }
  onConfirmed?.();
  return fetchCustomerAddresses();
}
