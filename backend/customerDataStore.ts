import { type Collection } from "mongodb";
import { getDatabase } from "./database.js";

export type CustomerAddress = {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  apartment?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type CustomerDataDocument = {
  userId: string;
  name?: string;
  email?: string;
  phone?: string;
  photo?: string;
  addresses?: CustomerAddress[];
  wishlist?: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerProfile = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  photo?: string;
  createdAt: Date;
  updatedAt: Date;
};

let collectionPromise: Promise<Collection<CustomerDataDocument>> | undefined;

function sanitizeAddress(address: CustomerAddress): CustomerAddress {
  return {
    id: address.id,
    fullName: address.fullName,
    phone: address.phone,
    address: address.address,
    ...(address.apartment ? { apartment: address.apartment } : {}),
    city: address.city,
    state: address.state,
    pinCode: address.pinCode,
    isDefault: address.isDefault === true,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

async function getCollection() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const collection = (await getDatabase()).collection<CustomerDataDocument>("user-datas");
      await collection.createIndex({ userId: 1 }, { unique: true, sparse: true, name: "customer_data_user_id_unique" });
      return collection;
    })().catch((error: unknown) => {
      collectionPromise = undefined;
      throw error;
    });
  }
  return collectionPromise;
}

async function ensureDataDocument(
  collection: Collection<CustomerDataDocument>,
  userId: string,
  identity?: Pick<CustomerProfile, "name" | "email" | "phone">,
) {
  try {
    await collection.updateOne(
      { userId },
      {
        $setOnInsert: {
          userId,
          ...(identity || {}),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
}

export async function getCustomerProfile(
  userId: string,
  identity: Pick<CustomerProfile, "name" | "email" | "phone">,
): Promise<CustomerProfile> {
  const collection = await getCollection();
  await ensureDataDocument(collection, userId, identity);
  const profileFields = ["name", "email", "phone"] as const;
  for (const field of profileFields) {
    await collection.updateOne(
      { userId, [field]: { $exists: false } },
      { $set: { [field]: identity[field], updatedAt: new Date() } },
    );
  }
  await collection.updateOne(
    { userId, email: { $ne: identity.email } },
    { $set: { email: identity.email, updatedAt: new Date() } },
  );
  const profile = await collection.findOne(
    { userId },
    { projection: { _id: 0, userId: 1, name: 1, email: 1, phone: 1, photo: 1, createdAt: 1, updatedAt: 1 } },
  );
  if (!profile) throw new Error("Customer profile could not be loaded after initialization");
  return {
    userId: profile.userId,
    name: profile.name || identity.name,
    email: identity.email,
    phone: profile.phone ?? identity.phone,
    ...(profile.photo ? { photo: profile.photo } : {}),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function updateCustomerProfile(
  userId: string,
  identityEmail: string,
  patch: { name: string; phone: string; photo?: string | null },
): Promise<CustomerProfile | null> {
  const collection = await getCollection();
  await ensureDataDocument(collection, userId);
  await collection.updateOne(
    { userId },
    {
      $set: {
        name: patch.name,
        email: identityEmail,
        phone: patch.phone,
        updatedAt: new Date(),
        ...(typeof patch.photo === "string" ? { photo: patch.photo } : {}),
      },
      ...(patch.photo === null ? { $unset: { photo: "" } } : {}),
    },
  );
  const profile = await collection.findOne(
    { userId },
    { projection: { _id: 0, userId: 1, name: 1, email: 1, phone: 1, photo: 1, createdAt: 1, updatedAt: 1 } },
  );
  if (!profile) return null;
  return {
    userId: profile.userId,
    name: profile.name || patch.name,
    email: identityEmail,
    phone: profile.phone ?? patch.phone,
    ...(profile.photo ? { photo: profile.photo } : {}),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function listCustomerAddresses(userId: string) {
  const document = await (await getCollection()).findOne({ userId }, { projection: { _id: 0, addresses: 1 } });
  return Array.isArray(document?.addresses) ? document.addresses.map(sanitizeAddress) : [];
}

export async function findCustomerAddress(userId: string, id: string) {
  const document = await (await getCollection()).findOne(
    { userId, "addresses.id": id },
    { projection: { _id: 0, addresses: 1 } },
  );
  const address = document?.addresses?.find((entry) => entry.id === id);
  return address ? sanitizeAddress(address) : null;
}

export async function addCustomerAddress(userId: string, address: CustomerAddress) {
  const collection = await getCollection();
  await ensureDataDocument(collection, userId);
  const existing = await collection.findOne({ userId, "addresses.id": address.id }, { projection: { _id: 0, addresses: 1 } });
  const existingAddress = existing?.addresses?.find((entry) => entry.id === address.id);
  if (existingAddress) return sanitizeAddress(existingAddress);
  const now = new Date();
  await collection.updateOne(
    { userId, "addresses.id": { $ne: address.id } },
    { $addToSet: { addresses: address }, $set: { updatedAt: now } },
  );
  const updated = await collection.findOne({ userId }, { projection: { _id: 0, addresses: 1 } });
  const saved = updated?.addresses?.find((entry) => entry.id === address.id);
  return saved ? sanitizeAddress(saved) : null;
}

export async function updateCustomerAddress(userId: string, id: string, patch: Omit<CustomerAddress, "id" | "createdAt" | "updatedAt">) {
  const collection = await getCollection();
  if (patch.isDefault) {
    await collection.updateOne(
      { userId },
      { $set: { "addresses.$[address].isDefault": false } },
      { arrayFilters: [{ "address.id": { $ne: id } }] },
    );
  }
  const now = new Date().toISOString();
  const result = await collection.findOneAndUpdate(
    { userId, "addresses.id": id },
    {
      $set: {
        "addresses.$.fullName": patch.fullName,
        "addresses.$.phone": patch.phone,
        "addresses.$.address": patch.address,
        "addresses.$.apartment": patch.apartment || "",
        "addresses.$.city": patch.city,
        "addresses.$.state": patch.state,
        "addresses.$.pinCode": patch.pinCode,
        "addresses.$.isDefault": patch.isDefault,
        "addresses.$.updatedAt": now,
        updatedAt: new Date(now),
      },
    },
    { returnDocument: "after", projection: { _id: 0, addresses: 1 } },
  );
  const updated = result?.addresses?.find((entry) => entry.id === id);
  return updated ? sanitizeAddress(updated) : null;
}

export async function deleteCustomerAddress(userId: string, id: string) {
  const collection = await getCollection();
  const document = await collection.findOneAndUpdate(
    { userId, "addresses.id": id },
    { $pull: { addresses: { id } }, $set: { updatedAt: new Date() } },
    { returnDocument: "after", projection: { _id: 0, addresses: 1 } },
  );
  if (!document) return false;
  const addresses = document.addresses || [];
  if (addresses.length && !addresses.some((entry) => entry.isDefault)) {
    await collection.updateOne(
      { userId },
      { $set: { "addresses.0.isDefault": true, updatedAt: new Date() } },
    );
  }
  return true;
}

export async function getCustomerWishlist(userId: string) {
  const document = await (await getCollection()).findOne({ userId }, { projection: { _id: 0, wishlist: 1 } });
  return Array.isArray(document?.wishlist)
    ? Array.from(new Set(document.wishlist.filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id))))
    : [];
}

export async function addCustomerWishlistItem(userId: string, productId: string) {
  const collection = await getCollection();
  await ensureDataDocument(collection, userId);
  await collection.updateOne({ userId }, { $addToSet: { wishlist: productId }, $set: { updatedAt: new Date() } });
  return getCustomerWishlist(userId);
}

export async function removeCustomerWishlistItem(userId: string, productId: string) {
  await (await getCollection()).updateOne(
    { userId },
    { $pull: { wishlist: productId }, $set: { updatedAt: new Date() } },
  );
  return getCustomerWishlist(userId);
}

export async function mergeCustomerWishlist(userId: string, productIds: string[]) {
  const collection = await getCollection();
  await ensureDataDocument(collection, userId);
  await collection.updateOne(
    { userId },
    { $addToSet: { wishlist: { $each: Array.from(new Set(productIds)) } }, $set: { updatedAt: new Date() } },
  );
  return getCustomerWishlist(userId);
}
