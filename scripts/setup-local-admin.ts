import { MongoClient } from "mongodb";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { hashPassword } from "../backend/authService.js";
import { isValidCustomerEmail, normalizeCustomerEmail } from "../backend/authStore.js";
import { fullAdminPermissions } from "../backend/adminPermissions.js";

export const localAdminDatabaseName = "tribull_local";

type LocalAdminSetupConfig = {
  mongoUri: string;
  email: string;
  password: string;
  name: string;
  mobile: string;
};

export function readLocalAdminSetupConfig(environment: NodeJS.ProcessEnv): LocalAdminSetupConfig {
  const nodeEnvironment = environment.NODE_ENV?.trim().toLowerCase();
  if (nodeEnvironment === "production") throw new Error("Refusing local admin setup when NODE_ENV=production");
  if (nodeEnvironment !== "development") throw new Error("NODE_ENV must be set to development for local admin setup");

  const mongoUri = environment.MONGODB_URI?.trim();
  const databaseName = environment.MONGODB_DB?.trim();
  if (!mongoUri) throw new Error("MONGODB_URI must explicitly point to local MongoDB");
  if (databaseName !== localAdminDatabaseName) {
    throw new Error(`MONGODB_DB must be exactly ${localAdminDatabaseName}`);
  }

  let mongoUrl: URL;
  try {
    mongoUrl = new URL(mongoUri);
  } catch {
    throw new Error("MONGODB_URI must be a valid local MongoDB URI");
  }
  if (mongoUrl.protocol !== "mongodb:" || !["127.0.0.1", "[::1]"].includes(mongoUrl.hostname)) {
    throw new Error("Local admin setup only permits MongoDB on the loopback address 127.0.0.1 or ::1");
  }
  if (mongoUrl.hash || (mongoUrl.pathname && mongoUrl.pathname !== `/${localAdminDatabaseName}`)) {
    throw new Error(`MONGODB_URI must not select a database other than ${localAdminDatabaseName}`);
  }

  const email = normalizeCustomerEmail(environment.ADMIN_TEST_EMAIL || "");
  if (!isValidCustomerEmail(email)) throw new Error("ADMIN_TEST_EMAIL must be a valid email address");
  const loginEmail = normalizeCustomerEmail(environment.ADMIN_LOGIN_EMAIL || "");
  if (loginEmail !== email) throw new Error("ADMIN_LOGIN_EMAIL must match ADMIN_TEST_EMAIL for local sign-in");

  const password = environment.ADMIN_TEST_PASSWORD || "";
  const passwordBytes = Buffer.byteLength(password, "utf8");
  if (passwordBytes < 8 || passwordBytes > 72) {
    throw new Error("ADMIN_TEST_PASSWORD must be between 8 and 72 UTF-8 bytes");
  }

  return {
    mongoUri,
    email,
    password,
    name: environment.ADMIN_TEST_NAME?.trim() || "Local Super Admin",
    mobile: environment.ADMIN_TEST_MOBILE?.trim() || "",
  };
}

export async function setupLocalAdminAccount(environment: NodeJS.ProcessEnv = process.env) {
  const config = readLocalAdminSetupConfig(environment);
  const passwordHash = await hashPassword(config.password);
  const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 8000 });

  try {
    await client.connect();
    const collection = client.db(localAdminDatabaseName).collection("user-credentials");
    await collection.createIndex(
      { email: 1 },
      { unique: true, collation: { locale: "en", strength: 2 }, name: "customer_email_unique" },
    );

    const now = new Date();
    const result = await collection.updateOne(
      { email: config.email },
      {
        $setOnInsert: {
          name: config.name,
          email: config.email,
          mobile: config.mobile,
          createdAt: now,
        },
        $set: {
          passwordHash,
          isProfileComplete: true,
          adminRole: "admin",
          adminTitle: "Super Admin",
          adminStatus: "Active",
          adminPermissions: fullAdminPermissions,
          updatedAt: now,
        },
        $addToSet: { authProviders: "password" },
        $inc: { tokenVersion: 1, adminTokenVersion: 1 },
      },
      { upsert: true, collation: { locale: "en", strength: 2 } },
    );
    return { created: result.upsertedCount === 1 };
  } finally {
    await client.close();
  }
}

async function main() {
  try {
    const result = await setupLocalAdminAccount();
    console.log(result.created ? "Local Super Admin test account created." : "Local Super Admin test account updated.");
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Refusing local admin setup")
      ? error.message
      : error instanceof Error && /^(NODE_ENV|MONGODB_|ADMIN_TEST_|ADMIN_LOGIN_EMAIL)/.test(error.message)
        ? error.message
        : "Local admin setup failed. Ensure MongoDB Community Server is installed and running on 127.0.0.1:27017, and verify the local settings.";
    console.error(message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main();
}