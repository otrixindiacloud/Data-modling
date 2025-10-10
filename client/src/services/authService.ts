interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  isSuperAdmin?: boolean | null;
}

interface AuthOrganization {
  id: number;
  name: string;
  slug: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  organization: AuthOrganization;
  roles: string[];
}

export interface AuthProfileResponse {
  user: AuthUser;
  organization: AuthOrganization;
  roles: string[];
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  organizationName: string;
  organizationSlug?: string;
  email: string;
  password: string;
  userName?: string;
}

async function requestJson<T>(input: string, init: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = await response.json();
      if (typeof payload?.message === "string") {
        message = payload.message;
      }
    } catch (error) {
      // Ignore JSON parsing issues and surface generic message
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return await requestJson<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registerAccount(payload: RegisterPayload): Promise<AuthResponse> {
  return await requestJson<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchProfile(): Promise<AuthProfileResponse> {
  const response = await fetch("/api/auth/me");
  if (!response.ok) {
    throw new Error("Failed to load profile");
  }
  return (await response.json()) as AuthProfileResponse;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
