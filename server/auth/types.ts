export interface AuthenticatedUserContext {
  userId: number;
  organizationId: number;
  roles: string[];
  isSuperAdmin: boolean;
}

export interface AuthTokenPayload {
  sub: number; // user id
  orgId: number; // organization id
  roles: string[];
  super?: boolean;
  exp: number;
  iat: number;
}
