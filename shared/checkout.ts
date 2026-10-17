export const indianStatesAndTerritories = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export const checkoutPaymentMethods = [
  { id: "upi", label: "UPI" },
  { id: "card", label: "Debit / credit card" },
  { id: "netbanking", label: "Net banking" },
  { id: "cod", label: "Cash on Delivery (COD)" },
] as const;

export type CheckoutPaymentMethod = typeof checkoutPaymentMethods[number]["id"];

export function normalizeIndianState(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
  return indianStatesAndTerritories.find((state) => state.toLowerCase() === normalized) || "";
}

export function isIndianState(value: unknown): value is typeof indianStatesAndTerritories[number] {
  return typeof value === "string" && normalizeIndianState(value) !== "";
}

export function isCheckoutPaymentMethod(value: unknown): value is CheckoutPaymentMethod {
  return typeof value === "string" && checkoutPaymentMethods.some((method) => method.id === value);
}

export function getCheckoutPaymentLabel(method: string) {
  return checkoutPaymentMethods.find((option) => option.id === method)?.label || method;
}
