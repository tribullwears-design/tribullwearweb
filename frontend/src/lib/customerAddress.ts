import { normalizeIndianState } from "../../../shared/checkout";

export type CustomerAddressFields = {
  fullName: string;
  phone: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  pinCode: string;
};

function cleanAddressText(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export function validateCustomerAddress(input: CustomerAddressFields): { value: CustomerAddressFields; error: string } {
  const value = {
    fullName: cleanAddressText(input.fullName),
    phone: cleanAddressText(input.phone),
    address: cleanAddressText(input.address),
    apartment: cleanAddressText(input.apartment),
    city: cleanAddressText(input.city),
    state: normalizeIndianState(cleanAddressText(input.state)),
    pinCode: cleanAddressText(input.pinCode),
  };
  const normalizedPhone = value.phone.replace(/[()\s-]/g, "");

  if (value.fullName.length < 2 || value.fullName.length > 80) {
    return { value, error: "Enter a full name between 2 and 80 characters." };
  }
  if (value.phone.length > 20 || !/^\+?\d{10,15}$/.test(normalizedPhone)) {
    return { value, error: "Enter a valid phone number with 10 to 15 digits." };
  }
  if (value.address.length < 5 || value.address.length > 240) {
    return { value, error: "Enter a street address between 5 and 240 characters." };
  }
  if (value.apartment.length > 120) {
    return { value, error: "Apartment / building must be 120 characters or fewer." };
  }
  if (value.city.length < 2 || value.city.length > 80) {
    return { value, error: "Enter a city between 2 and 80 characters." };
  }
  if (!value.state) {
    return { value, error: "Enter a valid Indian state or union territory." };
  }
  if (!/^\d{6}$/.test(value.pinCode)) {
    return { value, error: "Enter a valid 6-digit PIN code." };
  }
  return { value, error: "" };
}
