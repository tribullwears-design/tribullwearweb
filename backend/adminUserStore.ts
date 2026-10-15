import { ObjectId, type Collection } from "mongodb";
import { getDatabase } from "./database.js";
import { isValidCustomerEmail, normalizeCustomerEmail, type CustomerDocument } from "./authStore.js";
import { adminPermissionSections, fullAdminPermissions, type AdminPermissions } from "./adminPermissions.js";

export type AdminTitle = "Super Admin" | "Admin" | "Manager" | "Staff";
export type AdminStatus = "Active" | "Inactive";
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AdminTitle;
  status: AdminStatus;
  permissions: AdminPermissions;
};

type AdminUserDocument = CustomerDocument & {
  _id: ObjectId;
};

type AdminUserInput = {
  email?: unknown;
  role?: unknown;
  status?: unknown;
  permissions?: unknown;
};

export class AdminUserValidationError extends Error {}
export class AdminUserConflictError extends Error {}

const adminTitles: AdminTitle[] = ["Super Admin", "Admin", "Manager", "Staff"];
const adminStatuses: AdminStatus[] = ["Active", "Inactive"];

function getCollection(): Promise<Collection<AdminUserDocument>> {
  return getDatabase().then((database) => database.collection<AdminUserDocument>("user-credentials"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function validateAdminPermissions(value: unknown): AdminPermissions {
  if (!isRecord(value) || Object.keys(value).length !== adminPermissionSections.length
    || adminPermissionSections.some((section) => !Object.hasOwn(value, section))) {
    throw new AdminUserValidationError("Permissions must specify every admin section");
  }

  const permissions = {} as AdminPermissions;
  for (const section of adminPermissionSections) {
    const grant = value[section];
    if (!isRecord(grant) || typeof grant.view !== "boolean" || typeof grant.edit !== "boolean"
      || Object.keys(grant).length !== 2) {
      throw new AdminUserValidationError(`Permissions for ${section} must include boolean view and edit values`);
    }
    permissions[section] = { view: grant.view || grant.edit, edit: grant.edit };
  }
  return permissions;
}

function validateAdminInput(input: AdminUserInput, requireEmail: boolean) {
  if (!isRecord(input)) throw new AdminUserValidationError("Admin details are required");
  const email = typeof input.email === "string" ? normalizeCustomerEmail(input.email) : "";
  if (requireEmail && (!isValidCustomerEmail(email) || !email)) {
    throw new AdminUserValidationError("Enter a valid customer email address");
  }
  if (!adminTitles.includes(input.role as AdminTitle)) {
    throw new AdminUserValidationError("Choose a valid admin role");
  }
  if (!adminStatuses.includes(input.status as AdminStatus)) {
    throw new AdminUserValidationError("Choose a valid admin status");
  }
  return {
    email,
    role: input.role as AdminTitle,
    status: input.status as AdminStatus,
    permissions: validateAdminPermissions(input.permissions),
  };
}

function toAdminUser(customer: AdminUserDocument): AdminUser {
  return {
    id: customer._id.toString(),
    name: customer.name,
    email: customer.email,
    phone: customer.mobile,
    role: customer.adminTitle || "Admin",
    status: customer.adminStatus || "Active",
    permissions: customer.adminPermissions || fullAdminPermissions,
  };
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const users = await (await getCollection())
    .find(
      { adminRole: "admin" },
      { projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 } },
    )
    .sort({ name: 1, email: 1 })
    .toArray();
  return users.map(toAdminUser);
}

export async function createAdminUser(input: AdminUserInput): Promise<AdminUser> {
  const details = validateAdminInput(input, true);
  const collection = await getCollection();
  const customer = await collection.findOne(
    { email: details.email },
    { projection: { _id: 1, name: 1, email: 1, mobile: 1, adminRole: 1 }, collation: { locale: "en", strength: 2 } },
  );
  if (!customer) throw new AdminUserValidationError("No customer account exists for this email");
  if (customer.adminRole === "admin") throw new AdminUserConflictError("This customer is already an admin");

  const updated = await collection.findOneAndUpdate(
    { _id: customer._id, adminRole: { $ne: "admin" } },
    { $set: { adminRole: "admin", adminTitle: details.role, adminStatus: details.status, adminPermissions: details.permissions } },
    {
      returnDocument: "after",
      projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 },
    },
  );
  if (!updated) throw new AdminUserConflictError("This customer was granted admin access by another request");
  return toAdminUser(updated);
}

export async function updateAdminUser(id: string, input: AdminUserInput): Promise<AdminUser | null> {
  if (!ObjectId.isValid(id)) return null;
  const details = validateAdminInput(input, false);
  const collection = await getCollection();

  if (details.status === "Inactive") {
    const current = await collection.findOne({ _id: new ObjectId(id), adminRole: "admin" }, { projection: { adminStatus: 1 } });
    if (!current) return null;
    if (current.adminStatus !== "Inactive") {
      const activeCount = await collection.countDocuments({ adminRole: "admin", adminStatus: { $ne: "Inactive" } });
      if (activeCount <= 1) throw new AdminUserConflictError("At least one active admin account must remain");
    }
  }

  const updated = await collection.findOneAndUpdate(
    { _id: new ObjectId(id), adminRole: "admin" },
    { $set: { adminTitle: details.role, adminStatus: details.status, adminPermissions: details.permissions } },
    {
      returnDocument: "after",
      projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 },
    },
  );
  return updated ? toAdminUser(updated) : null;
}
