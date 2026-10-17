import { type Collection, ObjectId } from "mongodb";
import { getDatabase } from "./database.js";
import type { AdminPermissions } from "./adminPermissions.js";

export type CustomerDocument = {
  _id?: ObjectId;
  adminAccountSource?: "user-credentials" | "admin-datas";
  name: string;
  email: string;
  mobile: string;
  passwordHash?: string | null;
  adminRole?: "admin";
  adminTitle?: "Super Admin" | "Admin" | "Manager" | "Staff";
  adminStatus?: "Active" | "Inactive";
  adminPermissions?: AdminPermissions;
  googleId?: string;
  authProviders: ("password" | "google")[];
  isProfileComplete: boolean;
  tokenVersion: number;
  adminTokenVersion?: number;
  resetOtpEmail?: string;
  resetOtpHash?: string;
  resetOtpCreatedAt?: Date;
  resetOtpExpiresAt?: Date;
  resetOtpSentAt?: Date;
  resetOtpAttempts?: number;
  resetOtpVerifiedAt?: Date;
  resetAuthorizationHash?: string;
  resetAuthorizationExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SafeCustomer = {
  id: string;
  name: string;
  username: string;
  email: string;
  mobile: string;
  isProfileComplete: boolean;
};

let collectionPromise: Promise<Collection<CustomerDocument>> | undefined;

export function normalizeCustomerEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidCustomerEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeCustomerMobile(mobile: string) {
  return mobile.trim().replace(/[()\s-]/g, "");
}

export function isValidCustomerMobile(mobile: string) {
  return /^\+?\d{10,15}$/.test(normalizeCustomerMobile(mobile));
}

export function safeCustomer(customer: CustomerDocument): SafeCustomer {
  const id = customer._id?.toString() || "";
  return {
    id,
    name: customer.name,
    username: customer.name,
    email: customer.email,
    mobile: customer.mobile,
    isProfileComplete: customer.isProfileComplete,
  };
}

export async function listCustomersForAdmin(): Promise<SafeCustomer[]> {
  const customers = await (await getCollection())
    .find({}, { projection: { _id: 1, name: 1, email: 1, mobile: 1, isProfileComplete: 1 } })
    .sort({ name: 1, email: 1 })
    .toArray();
  return customers.map(safeCustomer);
}

async function getCollection() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const collection = (await getDatabase()).collection<CustomerDocument>("user-credentials");
      const customers = await collection.find({ email: { $type: "string" } }, { projection: { email: 1 } }).toArray();
      const emails = new Set<string>();
      for (const customer of customers) {
        const email = normalizeCustomerEmail(customer.email);
        if (emails.has(email)) {
          throw new Error("Duplicate customer emails must be resolved before enabling customer authentication");
        }
        emails.add(email);
      }
      await collection.createIndex({ email: 1 }, { unique: true, collation: { locale: "en", strength: 2 }, name: "customer_email_unique" });
      await collection.createIndex({ googleId: 1 }, { unique: true, sparse: true, name: "customer_google_id_unique" });
      await collection.createIndex({ resetOtpEmail: 1 }, { sparse: true, name: "customer_reset_otp_email" });
      await collection.createIndex({ resetAuthorizationHash: 1 }, { sparse: true, name: "customer_reset_authorization_hash" });
      return collection;
    })().catch((error: unknown) => {
      collectionPromise = undefined;
      throw error;
    });
  }
  return collectionPromise;
}

export async function findCustomerByEmail(email: string) {
  return (await getCollection()).findOne({ email: normalizeCustomerEmail(email) }, { collation: { locale: "en", strength: 2 } });
}

export async function findCustomerById(id: string) {
  if (!ObjectId.isValid(id)) return null;
  return (await getCollection()).findOne({ _id: new ObjectId(id) });
}

export async function findCustomerByGoogleId(googleId: string) {
  return (await getCollection()).findOne({ googleId });
}

export async function insertCustomer(customer: Omit<CustomerDocument, "_id">) {
  const collection = await getCollection();
  const result = await collection.insertOne(customer);
  return { ...customer, _id: result.insertedId };
}

export async function updateGoogleProfile(googleId: string, name: string, mobile: string) {
  return (await getCollection()).findOneAndUpdate(
    { googleId },
    {
      $set: { name, mobile, isProfileComplete: true, updatedAt: new Date() },
      $addToSet: { authProviders: "google" },
    },
    { returnDocument: "after" },
  );
}

const passwordRecoveryFields = {
  resetOtpEmail: "",
  resetOtpHash: "",
  resetOtpCreatedAt: "",
  resetOtpExpiresAt: "",
  resetOtpSentAt: "",
  resetOtpAttempts: "",
  resetOtpVerifiedAt: "",
  resetAuthorizationHash: "",
  resetAuthorizationExpiresAt: "",
} as const;

export async function issuePasswordOtp(
  customerId: ObjectId,
  email: string,
  otpHash: string,
  now: Date,
  expiresAt: Date,
  cooldownBefore: Date,
) {
  return (await getCollection()).updateOne(
    {
      _id: customerId,
      $or: [{ resetOtpSentAt: { $lte: cooldownBefore } }, { resetOtpSentAt: { $exists: false } }],
    },
    {
      $set: {
        resetOtpEmail: normalizeCustomerEmail(email),
        resetOtpHash: otpHash,
        resetOtpCreatedAt: now,
        resetOtpExpiresAt: expiresAt,
        resetOtpSentAt: now,
        resetOtpAttempts: 0,
        updatedAt: now,
      },
      $unset: { resetOtpVerifiedAt: "", resetAuthorizationHash: "", resetAuthorizationExpiresAt: "" },
    },
  );
}

export async function clearPasswordOtp(customerId: ObjectId, otpHash: string) {
  await (await getCollection()).updateOne(
    { _id: customerId, resetOtpHash: otpHash },
    {
      $unset: {
        resetOtpEmail: "",
        resetOtpHash: "",
        resetOtpCreatedAt: "",
        resetOtpExpiresAt: "",
        resetOtpAttempts: "",
        resetOtpVerifiedAt: "",
        resetAuthorizationHash: "",
        resetAuthorizationExpiresAt: "",
      },
    },
  );
}

export async function incrementPasswordOtpAttempt(email: string, now: Date) {
  return (await getCollection()).findOneAndUpdate(
    {
      resetOtpEmail: normalizeCustomerEmail(email),
      resetOtpHash: { $exists: true },
      resetOtpExpiresAt: { $gt: now },
      resetOtpVerifiedAt: { $exists: false },
      resetOtpAttempts: { $lt: 5 },
    },
    { $inc: { resetOtpAttempts: 1 } },
    { returnDocument: "after" },
  );
}

export async function verifyPasswordOtp(
  email: string,
  otpHash: string,
  authorizationHash: string,
  authorizationExpiresAt: Date,
  now: Date,
) {
  return (await getCollection()).findOneAndUpdate(
    {
      resetOtpEmail: normalizeCustomerEmail(email),
      resetOtpHash: otpHash,
      resetOtpExpiresAt: { $gt: now },
      resetOtpAttempts: { $lt: 5 },
      resetOtpVerifiedAt: { $exists: false },
    },
    {
      $set: {
        resetOtpVerifiedAt: now,
        resetAuthorizationHash: authorizationHash,
        resetAuthorizationExpiresAt: authorizationExpiresAt,
        updatedAt: now,
      },
      $unset: { resetOtpHash: "" },
    },
    { returnDocument: "after" },
  );
}

export async function consumePasswordReset(authorizationHash: string, passwordHash: string, now: Date) {
  return (await getCollection()).findOneAndUpdate(
    { resetAuthorizationHash: authorizationHash, resetAuthorizationExpiresAt: { $gt: now } },
    {
      $set: { passwordHash, updatedAt: now },
      $addToSet: { authProviders: "password" },
      $unset: passwordRecoveryFields,
      $inc: { tokenVersion: 1 },
    },
    { returnDocument: "after" },
  );
}

export async function incrementCustomerTokenVersion(id: string) {
  if (!ObjectId.isValid(id)) return;
  await (await getCollection()).updateOne({ _id: new ObjectId(id) }, { $inc: { tokenVersion: 1 }, $set: { updatedAt: new Date() } });
}

export async function incrementAdminTokenVersion(id: string, source: "user-credentials" | "admin-datas" = "user-credentials") {
  if (!ObjectId.isValid(id)) return;
  const collection = source === "admin-datas"
    ? (await getDatabase()).collection<CustomerDocument>("admin-datas")
    : await getCollection();
  await collection.updateOne({ _id: new ObjectId(id) }, { $inc: { adminTokenVersion: 1 }, $set: { updatedAt: new Date() } });
}
