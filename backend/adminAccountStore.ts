import { ObjectId, type Collection, type Filter } from "mongodb";
import bcrypt from "bcryptjs";
import { hashPassword } from "./authService.js";
import { getDatabase } from "./database.js";
import type { CustomerDocument } from "./authStore.js";

type AdminAccountSource = "user-credentials" | "admin-datas";
type AdminAccountDocument = CustomerDocument & { _id: ObjectId };
export type AdminAccountActor = { id?: string; source?: AdminAccountSource };

export class AdminAccountSettingsError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function accountCollection(source: AdminAccountSource): Promise<Collection<AdminAccountDocument>> {
  return getDatabase().then((database) => database.collection<AdminAccountDocument>(source));
}

export async function updateOwnAdminAccountSettings(actor: AdminAccountActor, input: unknown) {
  if (!actor.id || !ObjectId.isValid(actor.id) || !actor.source) {
    throw new AdminAccountSettingsError("Admin session is invalid. Sign in again.", 401);
  }
  if (!isRecord(input) || typeof input.name !== "string") {
    throw new AdminAccountSettingsError("Enter a valid name.", 400);
  }

  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    throw new AdminAccountSettingsError("Name must be between 2 and 80 characters.", 400);
  }

  const passwordFields = [input.currentPassword, input.newPassword, input.confirmNewPassword];
  const passwordChangeRequested = passwordFields.some((value) => value !== undefined && value !== "");
  if (passwordChangeRequested && passwordFields.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new AdminAccountSettingsError("Enter your current password, new password, and confirmation.", 400);
  }

  const [currentPassword, newPassword, confirmNewPassword] = passwordFields;
  if (passwordChangeRequested) {
    if (typeof newPassword !== "string" || Buffer.byteLength(newPassword, "utf8") < 8
      || Buffer.byteLength(newPassword, "utf8") > 72 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      throw new AdminAccountSettingsError("New password must be 8–72 bytes and include a letter and a number.", 400);
    }
    if (newPassword !== confirmNewPassword) {
      throw new AdminAccountSettingsError("New password and confirmation do not match.", 400);
    }
  }

  const collection = await accountCollection(actor.source);
  const accountId = new ObjectId(actor.id);
  const current = await collection.findOne(
    { _id: accountId, adminRole: "admin", adminStatus: { $ne: "Inactive" } },
    { projection: { passwordHash: 1 } },
  );
  if (!current) throw new AdminAccountSettingsError("Admin account not found or inactive.", 403);

  let passwordChanged = false;
  let passwordHash: string | undefined;
  if (passwordChangeRequested) {
    if (!current.passwordHash) {
      throw new AdminAccountSettingsError("Password changes are unavailable for this account.", 400);
    }
    if (!await bcrypt.compare(currentPassword as string, current.passwordHash)) {
      throw new AdminAccountSettingsError("Current password is incorrect.", 400);
    }
    if (await bcrypt.compare(newPassword as string, current.passwordHash)) {
      throw new AdminAccountSettingsError("Choose a new password different from your current password.", 400);
    }
    passwordHash = await hashPassword(newPassword as string);
    passwordChanged = true;
  }

  const filter: Filter<AdminAccountDocument> = {
    _id: accountId,
    adminRole: "admin",
    adminStatus: { $ne: "Inactive" },
    ...(passwordChanged ? { passwordHash: current.passwordHash } : {}),
  };
  const update = {
    $set: {
      name,
      updatedAt: new Date(),
      ...(passwordHash ? { passwordHash } : {}),
    },
    ...(passwordChanged ? {
      $addToSet: { authProviders: "password" as const },
      $inc: { adminTokenVersion: 1 },
    } : {}),
  };
  const account = await collection.findOneAndUpdate(filter, update, { returnDocument: "after" });
  if (!account) {
    throw new AdminAccountSettingsError("Admin account changed while saving. Reload and try again.", 409);
  }
  return { account, passwordChanged, source: actor.source };
}
