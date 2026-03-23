export const TOKEN_KEY = "access_token";
export const AUTH_CHANGED_EVENT = "convenio-auth-changed";

export function getToken() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function dispatchAuthChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    dispatchAuthChanged();
  } catch {
    // ignore
  }
}

export function clearToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    dispatchAuthChanged();
  } catch {
    // ignore
  }
}
