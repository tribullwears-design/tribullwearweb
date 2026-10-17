import { ObjectId, type Collection, type Db } from "mongodb";
import { getDatabase } from "./database.js";
import { isValidCustomerEmail, normalizeCustomerEmail, type CustomerDocument } from "./authStore.js";
import { fullAdminPermissions } from "./adminPermissions.js";

export type AdminTestAccountDocument = CustomerDocument & {
  _id: ObjectId;
  adminRole: "admin";
  adminTitle: "Super Admin";
  adminStatus: "Active";
};

export type AdminTestAccountInput = {
  email: string;
  passwordHash: string;
  name: string;
};

let collectionPromise: Promise<Collection<AdminTestAccountDocument>> | undefined;

function collectionFor(database: Db) {
  return database.collection<AdminTestAccountDocument>("admin-datas");
}

function getCollection() {
  if (!collectionPromise) {
    collectionPromise = getDatabase()
      .then(collectionFor)
      .catch((error: unknown) => {
        collectionPromise = undefined;
        throw error;
      });
  }
  return collectionPromise;
}

export function validateAdminTestAccountInput(input: AdminTestAccountInput) {
  const email = normalizeCustomerEmail(input.email);
  if (!isValidCustomerEmail(email)) throw new Error("ADMIN_TEST_EMAIL must be a valid email address");
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(input.passwordHash)) {
    throw new Error("A valid bcrypt password hash is required");
  }
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new Error("ADMIN_TEST_NAME must be between 2 and 80 characters");
  return { email, passwordHash: input.passwordHash, name };
}

export async function findAdminTestAccountByEmail(email: string) {
  return (await getCollection()).findOne(
    { email: normalizeCustomerEmail(email) },
    { collation: { locale: "en", strength: 2 } },
  );
}

export async function findAdminTestAccountById(id: string) {
  if (!ObjectId.isValid(id)) return null;
  return (await getCollection()).findOne({ _id: new ObjectId(id) });
}

export async function upsertAdminTestAccount(database: Db, input: AdminTestAccountInput) {
  const account = validateAdminTestAccountInput(input);
  const collection = collectionFor(database);
  await collection.createIndex(
    { email: 1 },
    { unique: true, collation: { locale: "en", strength: 2 }, name: "admin_datas_email_unique" },
  );

  const now = new Date();
  const result = await collection.updateOne(
    { email: account.email },
    {
      $setOnInsert: {
        email: account.email,
        mobile: "",
        createdAt: now,
      },
      $set: {
        name: account.name,
        passwordHash: account.passwordHash,
        adminRole: "admin",
        adminTitle: "Super Admin",
        adminStatus: "Active",
        adminPermissions: fullAdminPermissions,
        isProfileComplete: true,
        updatedAt: now,
      },
      $addToSet: { authProviders: "password" },
      $inc: { tokenVersion: 1, adminTokenVersion: 1 },
    },
    { upsert: true, collation: { locale: "en", strength: 2 } },
  );
  return { created: result.upsertedCount === 1 };
}
