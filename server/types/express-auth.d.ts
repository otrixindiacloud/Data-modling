import type { AuthenticatedUserContext } from "../auth/types";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUserContext;
    }
  }
}

export {};
