export function getAdminProductLoadError(status?: number) {
  if (status === 401) {
    return "Your admin session has expired or is missing. Sign in again to load saved products.";
  }
  if (status === 403) {
    return "Your account does not have permission to view products. Ask an admin to grant Products view access.";
  }
  return "Saved products could not be loaded because of an API or database error. Please retry; if it continues, contact support.";
}
