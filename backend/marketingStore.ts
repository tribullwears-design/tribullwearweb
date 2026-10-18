import { randomUUID } from "node:crypto";
import type { Collection } from "mongodb";
import { getDatabase } from "./database.js";

export const offerKinds = ["discount", "coupon", "promotion"] as const;
export type OfferKind = typeof offerKinds[number];
export function isOfferKind(value: string): value is OfferKind {
  return offerKinds.includes(value as OfferKind);
}
export type OfferDocument = {
  id: string;
  kind: OfferKind;
  name: string;
  code?: string;
  codeKey?: string;
  discountType: "percentage" | "fixed";
  value: number;
  minimumOrderAmount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
export type OfferInput = Omit<OfferDocument, "id" | "codeKey" | "createdAt" | "updatedAt">;

export class OfferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfferValidationError";
  }
}

export class OfferConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfferConflictError";
  }
}

async function getCollection(): Promise<Collection<OfferDocument>> {
  const collection = (await getDatabase()).collection<OfferDocument>("marketing-offers");
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ codeKey: 1 }, {
    unique: true,
    partialFilterExpression: { codeKey: { $type: "string" } },
  });
  await collection.createIndex({ kind: 1, isActive: 1, startsAt: 1, endsAt: 1 });
  return collection;
}

function parseOfferDate(value: unknown, field: string): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new OfferValidationError(`${field} must be a date or empty`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new OfferValidationError(`${field} is invalid`);
  return new Date(timestamp).toISOString();
}

export function validateOffer(value: unknown, kind: OfferKind): OfferInput {
  if (!offerKinds.includes(kind)) throw new OfferValidationError("Offer type is invalid");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OfferValidationError("Offer details are required");
  const input = value as Record<string, unknown>;
  const allowed = ["kind", "name", "code", "discountType", "value", "minimumOrderAmount", "startsAt", "endsAt", "isActive"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) throw new OfferValidationError("Offer contains unsupported fields");
  if (input.kind !== kind) throw new OfferValidationError("Offer type does not match this section");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 80) throw new OfferValidationError("Offer name must be between 1 and 80 characters");
  if (input.discountType !== "percentage" && input.discountType !== "fixed") throw new OfferValidationError("Discount type is invalid");
  if (typeof input.value !== "number" || !Number.isFinite(input.value) || input.value <= 0 || (input.discountType === "percentage" && input.value > 100)) {
    throw new OfferValidationError(input.discountType === "percentage" ? "Percentage must be greater than 0 and no more than 100" : "Discount value must be greater than 0");
  }
  if (typeof input.minimumOrderAmount !== "number" || !Number.isFinite(input.minimumOrderAmount) || input.minimumOrderAmount < 0) {
    throw new OfferValidationError("Minimum order amount must be a valid non-negative number");
  }
  if (typeof input.isActive !== "boolean") throw new OfferValidationError("Offer active status must be specified");
  const startsAt = parseOfferDate(input.startsAt, "Start date");
  const endsAt = parseOfferDate(input.endsAt, "End date");
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new OfferValidationError("End date must be after the start date");

  let code: string | undefined;
  if (kind === "coupon") {
    code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new OfferValidationError("Coupon code must be 3 to 32 letters, numbers, underscores, or hyphens");
  } else if (input.code !== undefined && input.code !== "") {
    throw new OfferValidationError("Only coupons can have a code");
  }

  return {
    kind,
    name,
    ...(code ? { code } : {}),
    discountType: input.discountType,
    value: input.value,
    minimumOrderAmount: input.minimumOrderAmount,
    startsAt,
    endsAt,
    isActive: input.isActive,
  };
}

export async function listOffers(kind: OfferKind) {
  if (!offerKinds.includes(kind)) throw new OfferValidationError("Offer type is invalid");
  return (await getCollection()).find({ kind }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
}

export async function findActiveCoupon(code: string, now = new Date()) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) return null;
  const offer = await (await getCollection()).findOne({ kind: "coupon", codeKey: normalized, isActive: true }, { projection: { _id: 0 } });
  if (!offer) return null;
  const time = now.getTime();
  if ((offer.startsAt && Date.parse(offer.startsAt) > time) || (offer.endsAt && Date.parse(offer.endsAt) <= time)) return null;
  return offer;
}

export async function findActiveDiscount(id: string, now = new Date()) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  const offer = await (await getCollection()).findOne({ id, kind: "discount", isActive: true }, { projection: { _id: 0 } });
  if (!offer) return null;
  const time = now.getTime();
  if ((offer.startsAt && Date.parse(offer.startsAt) > time) || (offer.endsAt && Date.parse(offer.endsAt) <= time)) return null;
  return offer;
}

export function calculateOfferDiscount(offer: Pick<OfferDocument, "discountType" | "value">, amount: number) {
  const discount = offer.discountType === "percentage" ? amount * offer.value / 100 : offer.value;
  return Math.min(amount, Math.max(0, Math.round(discount * 100) / 100));
}

async function ensureCodeAvailable(collection: Collection<OfferDocument>, code: string | undefined, excludingId?: string) {
  if (!code) return;
  const existing = await collection.findOne({ codeKey: code.toUpperCase(), ...(excludingId ? { id: { $ne: excludingId } } : {}) }, { projection: { _id: 1 } });
  if (existing) throw new OfferConflictError("A coupon with this code already exists");
}

export async function createOffer(kind: OfferKind, value: unknown) {
  const input = validateOffer(value, kind);
  const collection = await getCollection();
  await ensureCodeAvailable(collection, input.code);
  const now = new Date().toISOString();
  const document: OfferDocument = {
    id: randomUUID(),
    ...input,
    ...(input.code ? { codeKey: input.code.toUpperCase() } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await collection.insertOne(document);
  return document;
}

export async function updateOffer(kind: OfferKind, id: string, value: unknown) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new OfferValidationError("Offer ID is invalid");
  const input = validateOffer(value, kind);
  const collection = await getCollection();
  const existing = await collection.findOne({ id, kind });
  if (!existing) return null;
  await ensureCodeAvailable(collection, input.code, id);
  return collection.findOneAndUpdate(
    { id, kind },
    { $set: { ...input, ...(input.code ? { codeKey: input.code.toUpperCase() } : {}), updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
}

export async function deleteOffer(kind: OfferKind, id: string) {
  if (!offerKinds.includes(kind) || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new OfferValidationError("Offer identifier is invalid");
  const result = await (await getCollection()).deleteOne({ id, kind });
  return result.deletedCount > 0;
}
