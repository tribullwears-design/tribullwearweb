import { existsSync } from "node:fs";
import { MongoClient } from "mongodb";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hashPassword } from "../backend/authService.js";
import { isValidCustomerEmail, normalizeCustomerEmail } from "../backend/authStore.js";
import { upsertAdminTestAccount } from "../backend/adminTestStore.js";

type SetupConfig = {
  mongoUri: string;
  databaseName: string;
  email: string;
  password: string;
  name: string;
};

export function readAdminTestSetupConfig(environment: NodeJS.ProcessEnv): SetupConfig {
  const mongoUri = environment.MONGODB_URI?.trim();
  const databaseName = environment.MONGODB_DB?.trim();
  if (!mongoUri) throw new Error("MONGODB_URI must be configured for the explicit test-account setup command");
  if (!databaseName) throw new Error("MONGODB_DB must be configured explicitly for the test-account setup command");
  if (databaseName !== "tribull") {
    throw new Error("MONGODB_DB must be tribull for the approved Atlas test-account setup");
  }

  let mongoUrl: URL;
  try {
    mongoUrl = new URL(mongoUri);
  } catch {
    throw new Error("MONGODB_URI must be a valid MongoDB URI");
  }
  if (mongoUrl.protocol !== "mongodb+srv:" || !mongoUrl.hostname.endsWith(".mongodb.net")) {
    throw new Error("This setup command only permits a MongoDB Atlas mongodb+srv:// host");
  }
  let uriDatabaseName: string;
  try {
    uriDatabaseName = decodeURIComponent(mongoUrl.pathname.replace(/^\/+|\/+$/g, ""));
  } catch {
    throw new Error("MONGODB_URI contains invalid database path encoding");
  }
  if (uriDatabaseName && uriDatabaseName !== databaseName) {
    throw new Error("The database in MONGODB_URI must match MONGODB_DB");
  }

  const email = normalizeCustomerEmail(environment.ADMIN_TEST_EMAIL || "");
  if (!isValidCustomerEmail(email)) throw new Error("ADMIN_TEST_EMAIL must be a valid email address");
  const password = environment.ADMIN_TEST_PASSWORD || "";
  const passwordBytes = Buffer.byteLength(password, "utf8");
  if (passwordBytes < 12 || passwordBytes > 72) {
    throw new Error("ADMIN_TEST_PASSWORD must be between 12 and 72 UTF-8 bytes");
  }
  const name = environment.ADMIN_TEST_NAME?.trim() || "Testing Super Admin";
  if (name.length < 2 || name.length > 80) throw new Error("ADMIN_TEST_NAME must be between 2 and 80 characters");

  return { mongoUri, databaseName, email, password, name };
}

export async function setupAdminTestAccount(environment: NodeJS.ProcessEnv, confirmedEmail: string) {
  const config = readAdminTestSetupConfig(environment);
  if (normalizeCustomerEmail(confirmedEmail) !== config.email) {
    throw new Error("Explicit confirmation email must exactly match ADMIN_TEST_EMAIL");
  }

  const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    const database = client.db(config.databaseName);
    const lookup = {
      email: config.email,
    };
    const lookupOptions = {
      collation: { locale: "en", strength: 2 },
      projection: { _id: 1 },
    };
    const [existingCustomer, existingTestAdmin] = await Promise.all([
      database.collection("user-credentials").findOne(lookup, lookupOptions),
      database.collection("admin-datas").findOne(lookup, lookupOptions),
    ]);
    if (existingCustomer || existingTestAdmin) {
      throw new Error("ADMIN_TEST_EMAIL already exists in an account collection; choose a new email not present in either collection");
    }

    const passwordHash = await hashPassword(config.password);
    return await upsertAdminTestAccount(database, {
      email: config.email,
      name: config.name,
      passwordHash,
    });
  } finally {
    await client.close();
  }
}

export function loadAdminSetupEnvironmentFiles() {
  const localEnvPath = resolve(process.cwd(), "backend/.env.local");
  if (existsSync(localEnvPath)) process.loadEnvFile(localEnvPath);
}

export function parseAdminTestAccountConfirmation(args: string[]) {
  const forwardedArgs = args[0] === "--" ? args.slice(1) : args;
  if (forwardedArgs.length !== 2 || forwardedArgs[0] !== "--confirm-atlas-account-email" || !forwardedArgs[1]) {
    return null;
  }
  return forwardedArgs[1];
}

async function main() {
  const confirmation = parseAdminTestAccountConfirmation(process.argv.slice(2));
  if (!confirmation) {
    console.error("Refusing database write. Re-run explicitly with --confirm-atlas-account-email matching ADMIN_TEST_EMAIL.");
    process.exitCode = 1;
    return;
  }
  try {
    loadAdminSetupEnvironmentFiles();
    const result = await setupAdminTestAccount(process.env, confirmation);
    console.log(result.created ? "Testing Super Admin account created in admin-datas." : "Testing Super Admin account updated in admin-datas.");
  } catch (error) {
    const message = error instanceof Error
      && /^(MONGODB_URI|MONGODB_DB|ADMIN_TEST_|ADMIN_LOGIN_EMAIL|The database|Explicit confirmation)/.test(error.message)
      ? error.message
      : "Testing Super Admin setup failed. Verify the configured MongoDB connection and the explicit confirmation.";
    console.error(message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main();
}
