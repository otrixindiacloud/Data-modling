import jwt from "jsonwebtoken";
import type { AuthTokenPayload, AuthenticatedUserContext } from "./types";

const TOKEN_EXPIRY = process.env.JWT_EXPIRY ?? "12h";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable must be configured to enable authentication");
  }
  return secret;
}

export function signAuthToken(context: AuthenticatedUserContext): string {
  const payload = {
    sub: context.userId,
    orgId: context.organizationId,
    roles: context.roles,
    super: context.isSuperAdmin ? true : undefined,
  } satisfies Omit<AuthTokenPayload, "exp" | "iat">;

  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
}
