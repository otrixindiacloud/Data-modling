import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthenticatedUserContext } from "./types";

const authContext = new AsyncLocalStorage<AuthenticatedUserContext>();

export const DEFAULT_ORGANIZATION_ID = Number.parseInt(
  process.env.DEFAULT_ORGANIZATION_ID ?? "1",
  10,
);

export function setAuthContext(context: AuthenticatedUserContext): void {
  authContext.enterWith(context);
}

export function getAuthContext(): AuthenticatedUserContext | undefined {
  return authContext.getStore();
}

export function requireAuthContext(): AuthenticatedUserContext {
  const context = authContext.getStore();
  if (!context) {
    throw new Error("Authenticated request context is not available");
  }
  return context;
}

export function requireOrganizationId(): number {
  const context = authContext.getStore();
  if (context?.organizationId) {
    return context.organizationId;
  }
  if (Number.isNaN(DEFAULT_ORGANIZATION_ID)) {
    throw new Error("Organization context missing and DEFAULT_ORGANIZATION_ID is not configured");
  }
  return DEFAULT_ORGANIZATION_ID;
}

export function requireUserId(): number {
  const context = requireAuthContext();
  return context.userId;
}

export function currentRoles(): string[] {
  return getAuthContext()?.roles ?? [];
}

export function currentUserIsSuperAdmin(): boolean {
  return getAuthContext()?.isSuperAdmin ?? false;
}
