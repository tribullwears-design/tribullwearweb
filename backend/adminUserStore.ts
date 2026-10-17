import { ObjectId, type Collection, type Filter } from "mongodb";
import { hashPassword } from "./authService.js";
import { getDatabase } from "./database.js";
import { isValidCustomerEmail, normalizeCustomerEmail, type CustomerDocument } from "./authStore.js";
import { adminPermissionSections, canManageAdminUsers, getEffectiveAdminPermissions, type AdminPermissions, type AdminRoleTitle } from "./adminPermissions.js";

export type AdminTitle = AdminRoleTitle;
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

export type AdminUserAccountRecord = {
  id: string;
  source: "user-credentials" | "admin-datas";
  name: string;
  role: AdminTitle;
  status: AdminStatus;
  permissions: AdminPermissions;
};

export type AdminUserRecordGroup = {
  email: string;
  records: AdminUserAccountRecord[];
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

export type AdminUserActor = { id?: string; source?: "user-credentials" | "admin-datas"; role: AdminRoleTitle; permissions: AdminPermissions };

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
  const role = input.role as AdminTitle;
  const permissions = validateAdminPermissions(input.permissions);
  if (role === "Super Admin" && adminPermissionSections.some((section) =>
    !permissions[section].view || !permissions[section].edit)) {
    throw new AdminUserValidationError("Super Admin accounts must have all permissions");
  }
  if ((role === "Manager" || role === "Staff")) {
    const roleCeiling = getEffectiveAdminPermissions(role);
    if (adminPermissionSections.some((section) =>
      (permissions[section].view && !roleCeiling[section].view)
      || (permissions[section].edit && !roleCeiling[section].edit))) {
      throw new AdminUserValidationError("Permissions exceed the selected role's allowed access");
    }
  }
  return {
    email,
    role,
    status: input.status as AdminStatus,
    permissions,
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
    permissions: getEffectiveAdminPermissions(customer.adminTitle || "Admin", customer.adminPermissions),
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

export async function listDedicatedAdminAccounts(): Promise<AdminUser[]> {
  const users = await (await getDatabase())
    .collection<AdminUserDocument>("admin-datas")
    .find(
      { adminRole: "admin" },
      { projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 } },
    )
    .sort({ name: 1, email: 1 })
    .toArray();
  return users.map(toAdminUser);
}

export async function listAdminUserRecords(): Promise<AdminUserRecordGroup[]> {
  const database = await getDatabase();
  const [regularAdmins, testAdmins] = await Promise.all([
    database.collection<AdminUserDocument>("user-credentials")
      .find(
        { adminRole: "admin", email: { $type: "string" } },
        { projection: { _id: 1, name: 1, email: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 } },
      )
      .sort({ name: 1, email: 1 })
      .toArray(),
    database.collection<AdminUserDocument>("admin-datas")
      .find(
        { adminRole: "admin", email: { $type: "string" } },
        { projection: { _id: 1, name: 1, email: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 } },
      )
      .sort({ name: 1, email: 1 })
      .toArray(),
  ]);

  const grouped = new Map<string, AdminUserRecordGroup>();
  const addRecords = (users: AdminUserDocument[], source: AdminUserAccountRecord["source"]) => {
    for (const user of users) {
      const email = normalizeCustomerEmail(user.email);
      const group = grouped.get(email) || { email, records: [] };
      group.records.push({
        id: user._id.toString(),
        source,
        name: user.name || "",
        role: user.adminTitle || "Admin",
        status: user.adminStatus || "Active",
        permissions: getEffectiveAdminPermissions(user.adminTitle || "Admin", user.adminPermissions),
      });
      grouped.set(email, group);
    }
  };

  addRecords(regularAdmins, "user-credentials");
  addRecords(testAdmins, "admin-datas");
  return Array.from(grouped.values()).sort((left, right) => left.email.localeCompare(right.email));
}

export async function createAdminUser(input: AdminUserInput, actor: AdminUserActor): Promise<AdminUser> {
  const details = validateAdminInput(input, true);
  if (!canManageAdminUsers(actor, {}, details.role, details.permissions)) {
    throw new AdminUserValidationError("You are not authorized to grant this role or these permissions");
  }
  const collection = await getCollection();
  const customer = await collection.findOne(
    { email: details.email },
    { projection: { _id: 1, name: 1, email: 1, mobile: 1, adminRole: 1 }, collation: { locale: "en", strength: 2 } },
  );
  if (!customer) throw new AdminUserValidationError("No customer account exists for this email");
  if (customer.adminRole === "admin") throw new AdminUserConflictError("This customer is already an admin");

  const updated = await collection.findOneAndUpdate(
    { _id: customer._id, adminRole: { $ne: "admin" } },
    { $set: { adminRole: "admin", adminTitle: details.role, adminStatus: details.status, adminPermissions: details.permissions, updatedAt: new Date() } },
    {
      returnDocument: "after",
      projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 },
    },
  );
  if (!updated) throw new AdminUserConflictError("This customer was granted admin access by another request");
  return toAdminUser(updated);
}

export async function createDedicatedAdminAccount(input: unknown, actor: AdminUserActor): Promise<AdminUser> {
  if (actor.role !== "Super Admin") {
    throw new AdminUserValidationError("Only a Super Admin can create dedicated admin accounts");
  }
  if (!isRecord(input)) throw new AdminUserValidationError("Admin details are required");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    throw new AdminUserValidationError("Name must be between 2 and 80 characters");
  }
  const email = typeof input.email === "string" ? normalizeCustomerEmail(input.email) : "";
  if (!email || !isValidCustomerEmail(email)) {
    throw new AdminUserValidationError("Enter a valid email address");
  }
  if (typeof input.password !== "string" || Buffer.byteLength(input.password, "utf8") < 12
    || Buffer.byteLength(input.password, "utf8") > 72) {
    throw new AdminUserValidationError("Password must be between 12 and 72 UTF-8 bytes");
  }
  const { role, status, permissions } = validateAdminInput(input, true);
  const roleCeiling = getEffectiveAdminPermissions(role);
  if (adminPermissionSections.some((section) =>
    (permissions[section].view && !roleCeiling[section].view)
    || (permissions[section].edit && !roleCeiling[section].edit))) {
    throw new AdminUserValidationError("Permissions exceed the selected role's allowed access");
  }

  const database = await getDatabase();
  const regularAccounts = database.collection<AdminUserDocument>("user-credentials");
  const dedicatedAccounts = database.collection<AdminUserDocument>("admin-datas");
  await dedicatedAccounts.createIndex(
    { email: 1 },
    { unique: true, collation: { locale: "en", strength: 2 }, name: "admin_datas_email_unique" },
  );

  const [regularAccount, existingDedicatedAccount] = await Promise.all([
    regularAccounts.findOne({ email }, { projection: { _id: 1 }, collation: { locale: "en", strength: 2 } }),
    dedicatedAccounts.findOne({ email }, { projection: { _id: 1 }, collation: { locale: "en", strength: 2 } }),
  ]);
  if (regularAccount || existingDedicatedAccount) {
    throw new AdminUserConflictError("An account with this email already exists");
  }

  const now = new Date();
  const account: AdminUserDocument = {
    _id: new ObjectId(),
    name,
    email,
    mobile: "",
    passwordHash: await hashPassword(input.password),
    adminRole: "admin",
    adminTitle: role,
    adminStatus: status,
    adminPermissions: permissions,
    adminAccountType: "dedicated",
    authProviders: ["password"],
    isProfileComplete: true,
    tokenVersion: 0,
    adminTokenVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await dedicatedAccounts.insertOne(account);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new AdminUserConflictError("An account with this email already exists");
    }
    throw error;
  }
  return toAdminUser(account);
}

export async function updateDedicatedAdminAccount(id: string, input: unknown, actor: AdminUserActor): Promise<AdminUser | null> {
  if (actor.role !== "Super Admin") {
    throw new AdminUserValidationError("Only a Super Admin can manage dedicated admin accounts");
  }
  if (!ObjectId.isValid(id)) return null;
  if (!isRecord(input)) throw new AdminUserValidationError("Admin details are required");
  if (input.password !== undefined && typeof input.password !== "string") {
    throw new AdminUserValidationError("Password must be a string");
  }
  const passwordToHash = typeof input.password === "string" && input.password.length > 0 ? input.password : undefined;
  if (passwordToHash && (Buffer.byteLength(passwordToHash, "utf8") < 12
    || Buffer.byteLength(passwordToHash, "utf8") > 72)) {
    throw new AdminUserValidationError("Password must be between 12 and 72 UTF-8 bytes");
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    throw new AdminUserValidationError("Name must be between 2 and 80 characters");
  }
  const details = validateAdminInput(input, true);
  const roleCeiling = getEffectiveAdminPermissions(details.role);
  if (adminPermissionSections.some((section) =>
    (details.permissions[section].view && !roleCeiling[section].view)
    || (details.permissions[section].edit && !roleCeiling[section].edit))) {
    throw new AdminUserValidationError("Permissions exceed the selected role's allowed access");
  }

  const database = await getDatabase();
  const dedicatedAccounts = database.collection<AdminUserDocument>("admin-datas");
  const existing = await dedicatedAccounts.findOne(
    { _id: new ObjectId(id), adminRole: "admin" },
    { projection: { _id: 1, name: 1, email: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 } },
  );
  if (!existing) return null;

  const role = existing.adminTitle || "Admin";
  const permissions = getEffectiveAdminPermissions(role, existing.adminPermissions);
  const roleChanged = details.role !== role;
  const statusChanged = details.status !== (existing.adminStatus || "Active");
  const permissionsChanged = JSON.stringify(details.permissions) !== JSON.stringify(permissions);
  if (actor.id === id && actor.source !== "user-credentials" && (roleChanged || statusChanged || permissionsChanged)) {
    throw new AdminUserValidationError("You cannot change your own role, status, or permissions");
  }

  const regularAccount = await database.collection<AdminUserDocument>("user-credentials").findOne(
    { email: details.email },
    { projection: { _id: 1 }, collation: { locale: "en", strength: 2 } },
  );
  const duplicateDedicatedAccount = details.email === normalizeCustomerEmail(existing.email)
    ? null
    : await dedicatedAccounts.findOne(
      { email: details.email, _id: { $ne: existing._id } },
      { projection: { _id: 1 }, collation: { locale: "en", strength: 2 } },
    );
  if (regularAccount || duplicateDedicatedAccount) {
    throw new AdminUserConflictError("An account with this email already exists");
  }

  if (existing.adminTitle === "Super Admin"
    && (details.status === "Inactive" || details.role !== "Super Admin")
    && existing.adminStatus !== "Inactive") {
    const filter: Filter<AdminUserDocument> = {
      adminRole: "admin",
      adminTitle: "Super Admin",
      adminStatus: { $ne: "Inactive" },
    };
    const [customerSuperAdmins, dedicatedSuperAdmins] = await Promise.all([
      database.collection<AdminUserDocument>("user-credentials").countDocuments(filter),
      dedicatedAccounts.countDocuments(filter),
    ]);
    if (customerSuperAdmins + dedicatedSuperAdmins <= 1) {
      throw new AdminUserConflictError("At least one active Super Admin account must remain");
    }
  }

  const emailChanged = details.email !== normalizeCustomerEmail(existing.email);
  const authChanged = roleChanged || statusChanged || permissionsChanged || emailChanged || Boolean(passwordToHash);
  const update: {
    $set: Record<string, unknown>;
    $inc?: { adminTokenVersion: number };
  } = {
    $set: {
      name,
      email: details.email,
      adminTitle: details.role,
      adminStatus: details.status,
      adminPermissions: details.permissions,
      updatedAt: new Date(),
    },
  };
  if (passwordToHash) update.$set.passwordHash = await hashPassword(passwordToHash);
  if (authChanged) update.$inc = { adminTokenVersion: 1 };

  try {
    const updated = await dedicatedAccounts.findOneAndUpdate(
      { _id: existing._id, adminRole: "admin" },
      update,
      {
        returnDocument: "after",
        projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 },
      },
    );
    return updated ? toAdminUser(updated) : null;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new AdminUserConflictError("An account with this email already exists");
    }
    throw error;
  }
}

export async function deactivateDedicatedAdminAccount(id: string, actor: AdminUserActor): Promise<AdminUser | null> {
  if (actor.role !== "Super Admin") {
    throw new AdminUserValidationError("Only a Super Admin can manage dedicated admin accounts");
  }
  if (!ObjectId.isValid(id)) return null;
  if (actor.id === id && actor.source !== "user-credentials") {
    throw new AdminUserValidationError("You cannot deactivate your own admin account");
  }

  const database = await getDatabase();
  const dedicatedAccounts = database.collection<AdminUserDocument>("admin-datas");
  const existing = await dedicatedAccounts.findOne(
    { _id: new ObjectId(id), adminRole: "admin" },
    { projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 } },
  );
  if (!existing) return null;
  if (existing.adminStatus !== "Inactive" && existing.adminTitle === "Super Admin") {
    const filter: Filter<AdminUserDocument> = {
      adminRole: "admin",
      adminTitle: "Super Admin",
      adminStatus: { $ne: "Inactive" },
    };
    const [customerSuperAdmins, dedicatedSuperAdmins] = await Promise.all([
      database.collection<AdminUserDocument>("user-credentials").countDocuments(filter),
      dedicatedAccounts.countDocuments(filter),
    ]);
    if (customerSuperAdmins + dedicatedSuperAdmins <= 1) {
      throw new AdminUserConflictError("At least one active Super Admin account must remain");
    }
  }
  if (existing.adminStatus === "Inactive") return toAdminUser(existing);

  const updated = await dedicatedAccounts.findOneAndUpdate(
    { _id: existing._id, adminRole: "admin", adminStatus: { $ne: "Inactive" } },
    { $set: { adminStatus: "Inactive", updatedAt: new Date() }, $inc: { adminTokenVersion: 1 } },
    {
      returnDocument: "after",
      projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 },
    },
  );
  return updated ? toAdminUser(updated) : null;
}

export async function deleteAdminAccount(
  source: "user-credentials" | "admin-datas",
  id: string,
  actor: AdminUserActor,
): Promise<Pick<AdminUser, "id" | "name" | "email" | "role"> & { source: typeof source } | null> {
  if (actor.role !== "Super Admin") {
    throw new AdminUserValidationError("Only a Super Admin can delete admin accounts");
  }
  if (!ObjectId.isValid(id)) return null;
  if (actor.id === id && actor.source === source) {
    throw new AdminUserValidationError("You cannot delete your own admin account");
  }

  const database = await getDatabase();
  const collection = database.collection<AdminUserDocument>(source);
  const accountId = new ObjectId(id);
  const existing = await collection.findOne(
    { _id: accountId, adminRole: "admin" },
    { projection: { _id: 1, name: 1, email: 1, adminRole: 1, adminTitle: 1 } },
  );
  if (!existing || existing.adminRole !== "admin") return null;
  const role = existing.adminTitle || "Admin";
  if (role === "Super Admin") {
    throw new AdminUserValidationError("Super Admin accounts cannot be deleted");
  }
  if (role !== "Admin" && role !== "Manager" && role !== "Staff") {
    throw new AdminUserValidationError("Only Admin, Manager, or Staff accounts can be deleted");
  }

  if (source === "admin-datas") {
    const result = await collection.deleteOne({
      _id: accountId,
      adminRole: "admin",
      adminTitle: { $ne: "Super Admin" },
    });
    if (result.deletedCount !== 1) return null;
  } else {
    const result = await collection.updateOne(
      { _id: accountId, adminRole: "admin", adminTitle: { $ne: "Super Admin" } },
      {
        $unset: {
          adminRole: "",
          adminTitle: "",
          adminStatus: "",
          adminPermissions: "",
          adminAccountSource: "",
          adminAccountType: "",
        },
        $inc: { adminTokenVersion: 1 },
        $set: { updatedAt: new Date() },
      },
    );
    if (result.modifiedCount !== 1) return null;
  }
  return { id, name: existing.name, email: existing.email, role, source };
}

export async function updateAdminUser(id: string, input: AdminUserInput, actor: AdminUserActor): Promise<AdminUser | null> {
  if (!ObjectId.isValid(id)) return null;
  const details = validateAdminInput(input, false);
  const collection = await getCollection();

  const current = await collection.findOne({ _id: new ObjectId(id), adminRole: "admin" }, { projection: { adminStatus: 1, adminTitle: 1 } });
  if (!current) return null;
  if (!canManageAdminUsers(actor, { id, role: current.adminTitle || "Admin" }, details.role, details.permissions)) {
    throw new AdminUserValidationError("You are not authorized to change this role or these permissions");
  }
  const isLastSuperAdminChange = current.adminTitle === "Super Admin"
    && (details.status === "Inactive" || details.role !== "Super Admin")
    && current.adminStatus !== "Inactive";
  if (isLastSuperAdminChange) {
    const activeSuperAdmins = await collection.countDocuments({ adminRole: "admin", adminTitle: "Super Admin", adminStatus: { $ne: "Inactive" } });
    if (activeSuperAdmins <= 1) throw new AdminUserConflictError("At least one active Super Admin account must remain");
  }

  if (details.status === "Inactive") {
    const status = current.adminStatus;
    if (status !== "Inactive") {
      const activeCount = await collection.countDocuments({ adminRole: "admin", adminStatus: { $ne: "Inactive" } });
      if (activeCount <= 1) throw new AdminUserConflictError("At least one active admin account must remain");
    }
  }

  const updated = await collection.findOneAndUpdate(
    { _id: new ObjectId(id), adminRole: "admin" },
    { $set: { adminTitle: details.role, adminStatus: details.status, adminPermissions: details.permissions, updatedAt: new Date() } },
    {
      returnDocument: "after",
      projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 },
    },
  );
  return updated ? toAdminUser(updated) : null;
}
