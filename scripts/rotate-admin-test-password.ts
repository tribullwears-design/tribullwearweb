import { MongoClient } from "mongodb";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hashPassword } from "../backend/authService.js";
import { normalizeCustomerEmail } from "../backend/authStore.js";
import {
  loadAdminSetupEnvironmentFiles,
  parseAdminTestAccountConfirmation,
  readAdminTestSetupConfig,
} from "./setup-admin-test-account.js";

export async function rotateAdminTestPassword(environment: NodeJS.ProcessEnv, confirmedEmail: string) {
  const config = readAdminTestSetupConfig(environment);
  if (normalizeCustomerEmail(confirmedEmail) !== config.email) {
    throw new Error("Explicit confirmation email must exactly match ADMIN_TEST_EMAIL");
  }

  const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    const database = client.db(config.databaseName);
    const lookup = { email: config.email };
    const lookupOptions = {
      collation: { locale: "en", strength: 2 },
      projection: { _id: 1, adminRole: 1, adminTitle: 1, adminStatus: 1 },
    };
    const [customer, testAdmin] = await Promise.all([
      database.collection("user-credentials").findOne(lookup, lookupOptions),
      database.collection("admin-datas").findOne(lookup, lookupOptions),
    ]);

    if (customer) {
      throw new Error("ADMIN_TEST_EMAIL also exists in user-credentials; password rotation refused");
    }
    if (!testAdmin) {
      throw new Error("No existing admin-datas account matches ADMIN_TEST_EMAIL; password rotation cannot create accounts");
    }
    if (testAdmin.adminRole !== "admin" || testAdmin.adminTitle !== "Super Admin" || testAdmin.adminStatus !== "Active") {
      throw new Error("The configured admin-datas account is not an active Super Admin; password rotation refused");
    }

    const passwordHash = await hashPassword(config.password);
    const update = await database.collection("admin-datas").updateOne(
      {
        _id: testAdmin._id,
        email: config.email,
        adminRole: "admin",
        adminTitle: "Super Admin",
        adminStatus: "Active",
      },
      {
        $set: { passwordHash, updatedAt: new Date() },
        $inc: { tokenVersion: 1, adminTokenVersion: 1 },
      },
      { collation: { locale: "en", strength: 2 } },
    );
    if (update.matchedCount !== 1) {
      throw new Error("The configured admin-datas account changed during password rotation; no account was updated");
    }
    return { rotated: true };
  } finally {
    await client.close();
  }
}

async function main() {
  const confirmation = parseAdminTestAccountConfirmation(process.argv.slice(2));
  if (!confirmation) {
    console.error("Refusing password change. Re-run explicitly with --confirm-atlas-account-email matching ADMIN_TEST_EMAIL.");
    process.exitCode = 1;
    return;
  }

  try {
    loadAdminSetupEnvironmentFiles();
    await rotateAdminTestPassword(process.env, confirmation);
    console.log("Testing Super Admin password changed; existing sessions invalidated.");
  } catch (error) {
    const message = error instanceof Error
      && /^(MONGODB_URI|MONGODB_DB|ADMIN_TEST_|The database|Explicit confirmation|No existing|ADMIN_TEST_EMAIL also|The configured|The configured admin-datas)/.test(error.message)
      ? error.message
      : "Testing Super Admin password change failed. Verify the local environment and configured test account.";
    console.error(message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main();
}
