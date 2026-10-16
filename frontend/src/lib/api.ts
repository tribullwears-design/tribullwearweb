export const productionApiBaseUrl = "https://tribullwearweb.onrender.com";

export function resolveApiBaseUrl(configuredBaseUrl?: string) {
  return configuredBaseUrl?.trim().replace(/\/+$/, "") || productionApiBaseUrl;
}

const configuredApiBaseUrl = resolveApiBaseUrl(import.meta.env.CATEGORY_API_URL);

export function apiUrl(path: string) {
  // Browser requests stay same-origin so Vercel can proxy /api/* to Render and
  // preserve the customer session cookie without relying on third-party cookie
  // support. Vite's development proxy handles the same relative path locally.
  if (typeof window !== "undefined") return path;
  return `${configuredApiBaseUrl}${path}`;
}

export function apiFetch(input: string, init?: RequestInit) {
  return fetch(apiUrl(input), {
    ...init,
    credentials: init?.credentials ?? "include",
  });
}
