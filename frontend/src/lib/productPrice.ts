export type PriceValue = string | number | null | undefined;
export type OriginalPriceFields = {
  originalPrice?: PriceValue;
  mrp?: PriceValue;
  MRP?: PriceValue;
  compareAtPrice?: PriceValue;
  compareAt?: PriceValue;
  oldPrice?: PriceValue;
};

export function parsePrice(value: PriceValue): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : undefined;
  if (typeof value !== "string") return undefined;
  const digits = value.replace(/[^\d.]/g, "");
  if (!digits) return undefined;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function resolveOriginalPrice(fields: OriginalPriceFields): number | undefined {
  return [
    fields.originalPrice,
    fields.mrp,
    fields.MRP,
    fields.compareAtPrice,
    fields.compareAt,
    fields.oldPrice,
  ].map(parsePrice).find((value) => value !== undefined);
}

export function getDiscountPercentage(sellingPrice: number, originalPrice: PriceValue): number | undefined {
  const original = parsePrice(originalPrice);
  if (original === undefined || original <= sellingPrice || original === 0) return undefined;
  return Math.round(((original - sellingPrice) / original) * 100);
}

export function formatProductPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}
