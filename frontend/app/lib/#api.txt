const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000";

export const TOKEN_KEY = "access_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function buildHeaders(extra = {}) {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export async function apiGet(path, extraOptions = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(),
    cache: "no-store",
    ...extraOptions,
  });
  return handleResponse(res);
}

export async function apiPost(path, body, extraOptions = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
    ...extraOptions,
  });
  return handleResponse(res);
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(options.headers || {}),
    cache: "no-store",
    ...options,
  });
  return handleResponse(res);
}