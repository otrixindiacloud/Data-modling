const STORAGE_KEY = "auth.token";

let inMemoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (inMemoryToken) {
    return inMemoryToken;
  }
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  inMemoryToken = stored;
  return stored;
}

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function clearAuthToken(): void {
  setAuthToken(null);
}
