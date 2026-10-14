const configuredApiBaseUrl = import.meta.env.CATEGORY_API_URL?.trim().replace(/\/+$/, "") || "";

export function apiUrl(path: string) {
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) return path;
  return `${configuredApiBaseUrl}${path}`;
}

export function apiFetch(input: string, init?: RequestInit) {
  return fetch(apiUrl(input), {
    ...init,
    credentials: init?.credentials ?? "include",
  });
}
