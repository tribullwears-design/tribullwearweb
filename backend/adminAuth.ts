import type { RequestHandler } from "express";
import { adminCookieName, getSessionAdmin } from "./authService.js";
import { getEffectiveAdminPermissions, hasAdminPermission, type AdminPermissionAction, type AdminPermissionSection, type AdminRoleTitle } from "./adminPermissions.js";

export type AdminAuthorization = { allowed: true } | { allowed: false; status: 401 | 403; error: string };

export function authorizeAdmin(
  isAuthenticated: boolean,
  adminRole: string | undefined,
  adminStatus?: string,
  permissions?: Parameters<typeof hasAdminPermission>[0],
  requiredPermission?: { section: AdminPermissionSection; action: AdminPermissionAction },
  adminTitle?: AdminRoleTitle,
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

  const effectivePermissions = getEffectiveAdminPermissions(adminTitle || "Admin", permissions);
  if (requiredPermission && !hasAdminPermission(effectivePermissions, requiredPermission.section, requiredPermission.action)) {
    return { allowed: false, status: 403, error: "You do not have permission to perform this action" };
  }

  return { allowed: true };
}

function adminMiddleware(
  requiredPermission?: { section: AdminPermissionSection; action: AdminPermissionAction },
  requiredRole?: "Super Admin",
): RequestHandler {
  return (request, response, next) => {
    void getSessionAdmin(request)
      .then((customer) => {
        const authorization = authorizeAdmin(
          Boolean(customer),
          customer?.adminRole,
          customer?.adminStatus,
          customer?.adminPermissions,
          requiredPermission,
          customer?.adminTitle || "Admin",
        );
        if (!authorization.allowed) {
          const category = authorization.status === 401
            ? hasCustomerSessionCookie(request) ? "invalid_or_expired_session" : "session_cookie_missing"
            : authorization.error === "Admin access is required"
              ? "admin_role_missing"
              : authorization.error === "This admin account is inactive"
                ? "admin_grant_inactive"
                : "admin_permission_missing";
          console.warn("Admin authorization denied", {
            category,
            method: request.method,
            path: request.path,
          });
          response.status(authorization.status).json({ error: authorization.error });
          return;
        }
        if (requiredRole && customer?.adminTitle !== requiredRole) {
          response.status(403).json({ error: "Only a Super Admin can view all admin account records" });
          return;
        }
        response.locals.adminActor = {
          id: customer?._id?.toString(),
          source: customer?.adminAccountSource || "user-credentials",
          role: customer?.adminTitle || "Admin",
          permissions: getEffectiveAdminPermissions(customer?.adminTitle || "Admin", customer?.adminPermissions),
        };
        next();
      })
      .catch((error: unknown) => {
        console.error("Admin session lookup failed", {
          category: "session_lookup_error",
          method: request.method,
          path: request.path,
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
        response.status(500).json({ error: "Unable to verify admin access" });
      });
  };
}

function hasCustomerSessionCookie(request: Parameters<RequestHandler>[0]) {
  const cookieHeader = request.headers?.cookie;
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => {
    const separator = part.indexOf("=");
    return separator >= 0
      && part.slice(0, separator).trim() === adminCookieName
      && part.slice(separator + 1).trim().length > 0;
  });
}

export const requireAdmin: RequestHandler = adminMiddleware();

export function requireAdminPermission(section: AdminPermissionSection, action: AdminPermissionAction): RequestHandler {
  return adminMiddleware({ section, action });
}

export const requireSuperAdmin: RequestHandler = adminMiddleware(undefined, "Super Admin");
