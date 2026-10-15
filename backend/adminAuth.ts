import type { RequestHandler } from "express";
import { getSessionCustomer } from "./authService.js";
import { hasAdminPermission, type AdminPermissionAction, type AdminPermissionSection } from "./adminPermissions.js";

export type AdminAuthorization = { allowed: true } | { allowed: false; status: 401 | 403; error: string };

export function authorizeAdmin(
  isAuthenticated: boolean,
  adminRole: string | undefined,
  adminStatus?: string,
  permissions?: Parameters<typeof hasAdminPermission>[0],
  requiredPermission?: { section: AdminPermissionSection; action: AdminPermissionAction },
): AdminAuthorization {
  if (!isAuthenticated) {
    return { allowed: false, status: 401, error: "Sign in with an authorized admin account" };
  }

  if (adminRole !== "admin") {
    return { allowed: false, status: 403, error: "Admin access is required" };
  }

  if (adminStatus !== undefined && adminStatus !== "Active") {
    return { allowed: false, status: 403, error: "This admin account is inactive" };
  }

  if (requiredPermission && !hasAdminPermission(permissions, requiredPermission.section, requiredPermission.action)) {
    return { allowed: false, status: 403, error: "You do not have permission to perform this action" };
  }

  return { allowed: true };
}

function adminMiddleware(requiredPermission?: { section: AdminPermissionSection; action: AdminPermissionAction }): RequestHandler {
  return (request, response, next) => {
    void getSessionCustomer(request)
      .then((customer) => {
        const authorization = authorizeAdmin(
          Boolean(customer),
          customer?.adminRole,
          customer?.adminStatus,
          customer?.adminPermissions,
          requiredPermission,
        );
        if (!authorization.allowed) {
          response.status(authorization.status).json({ error: authorization.error });
          return;
        }
        next();
      })
      .catch((error: unknown) => {
        console.error("Admin session lookup failed", error);
        response.status(500).json({ error: "Unable to verify admin access" });
      });
  };
}

export const requireAdmin: RequestHandler = adminMiddleware();

export function requireAdminPermission(section: AdminPermissionSection, action: AdminPermissionAction): RequestHandler {
  return adminMiddleware({ section, action });
}
