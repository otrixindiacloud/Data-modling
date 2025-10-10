import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../auth/jwt";
import { setAuthContext } from "../auth/context";
import type { AuthenticatedUserContext } from "../auth/types";

const SKIP_PATHS = new Set<string>(["/api/auth/login", "/api/auth/register", "/api/auth/refresh"]);

function shouldBypassAuth(req: Request): boolean {
  if (req.method === "OPTIONS") {
    return true;
  }
  if (SKIP_PATHS.has(req.path)) {
    return true;
  }
  // Allow static assets without auth
  if (!req.path.startsWith("/api")) {
    return true;
  }
  return false;
}

export function authenticationMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (shouldBypassAuth(req)) {
    return next();
  }

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    console.error(`[AUTH] No token provided for ${req.method} ${req.path}`);
    res.status(401).json({ message: "Authentication token is required" });
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    const context: AuthenticatedUserContext = {
      userId: payload.sub,
      organizationId: payload.orgId,
      roles: payload.roles ?? [],
      isSuperAdmin: Boolean(payload.super),
    };

    setAuthContext(context);
    req.auth = context;
    next();
  } catch (error) {
    console.error(`[AUTH] Token verification failed for ${req.method} ${req.path}:`, error instanceof Error ? error.message : error);
    res.status(401).json({ message: "Invalid or expired authentication token" });
  }
}

export function requireRole(role: string) {
  return function roleGuard(req: Request, res: Response, next: NextFunction): void {
    const roles = req.auth?.roles ?? [];
    if (roles.includes(role) || req.auth?.isSuperAdmin) {
      next();
      return;
    }
    res.status(403).json({ message: "Forbidden" });
  };
}
