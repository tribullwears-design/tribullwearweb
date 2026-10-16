import type { RequestHandler } from "express";
import { customerCookieName, getSessionCustomer } from "./authService.js";
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
      && part.slice(0, separator).trim() === customerCookieName
      && part.slice(separator + 1).trim().length > 0;
  });
}

export const requireAdmin: RequestHandler = adminMiddleware();

export function requireAdminPermission(section: AdminPermissionSection, action: AdminPermissionAction): RequestHandler {
  return adminMiddleware({ section, action });
}
