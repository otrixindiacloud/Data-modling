import type { Storage } from "../storage";
import type { System } from "@shared/schema";

/**
 * Parse optional number values from request parameters
 * Handles undefined, null, empty string, and invalid numbers
 */
export function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Parse required number values from request parameters
 * Throws error if value is invalid
 */
export function parseRequiredNumber(value: unknown, fieldName: string): number {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  return parsed;
}

/**
 * Get system ID by name or return existing ID
 * @param systems - List of all systems
 * @param targetSystemId - Optional existing system ID
 * @param targetSystemName - Optional system name to search for
 */
export function resolveSystemId(
  systems: System[],
  targetSystemId?: number | null,
  targetSystemName?: string | null
): number | null {
  if (targetSystemId) {
    const system = systems.find((s) => s.id === targetSystemId);
    return system?.id ?? null;
  }
  
  if (targetSystemName) {
    const system = systems.find((s) => s.name === targetSystemName);
    return system?.id ?? null;
  }
  
  return null;
}

/**
 * Get system ID by name (async version that queries storage)
 */
export async function getSystemIdByName(
  storage: Storage,
  systemName: string
): Promise<number | null> {
  const systems = await storage.getSystems();
  const system = systems.find((s) => s.name === systemName);
  return system?.id || null;
}

/**
 * Validate that a domain exists and return it
 */
export async function validateDomain(
  storage: Storage,
  domainId: number | null
): Promise<{ id: number; name: string; description: string | null } | null> {
  if (!domainId) return null;
  
  const domain = await storage.getDataDomain(domainId);
  if (!domain) {
    throw new Error("Selected domain does not exist");
  }
  
  return domain;
}

/**
 * Validate that a data area exists and belongs to the specified domain
 */
export async function validateDataArea(
  storage: Storage,
  dataAreaId: number | null,
  expectedDomainId?: number | null
): Promise<{ id: number; name: string; domainId: number; description: string | null } | null> {
  if (!dataAreaId) return null;
  
  const dataArea = await storage.getDataArea(dataAreaId);
  if (!dataArea) {
    throw new Error("Selected data area does not exist");
  }
  
  if (expectedDomainId && dataArea.domainId !== expectedDomainId) {
    throw new Error("Selected data area does not belong to the provided domain");
  }
  
  return dataArea;
}

/**
 * Resolve domain and data area, ensuring they're compatible
 * Returns the resolved domain and data area IDs
 */
export async function resolveDomainAndArea(
  storage: Storage,
  domainId: unknown,
  dataAreaId: unknown
): Promise<{
  domainId: number | null;
  dataAreaId: number | null;
  domain: { id: number; name: string; description: string | null } | null;
  dataArea: { id: number; name: string; domainId: number; description: string | null } | null;
}> {
  const parsedDomainId = parseOptionalNumber(domainId);
  const parsedDataAreaId = parseOptionalNumber(dataAreaId);
  
  let domainRecord = parsedDomainId ? await storage.getDataDomain(parsedDomainId) : null;
  if (parsedDomainId && !domainRecord) {
    throw new Error("Selected domain does not exist");
  }
  
  let dataAreaRecord = parsedDataAreaId ? await storage.getDataArea(parsedDataAreaId) : null;
  if (parsedDataAreaId && !dataAreaRecord) {
    throw new Error("Selected data area does not exist");
  }
  
  // If data area is provided, ensure it matches the domain
  if (dataAreaRecord) {
    if (domainRecord && dataAreaRecord.domainId !== domainRecord.id) {
      throw new Error("Selected data area does not belong to the provided domain");
    }
    // If no domain specified but data area is, fetch the domain
    if (!domainRecord) {
      domainRecord = await storage.getDataDomain(dataAreaRecord.domainId) ?? null;
    }
  }
  
  return {
    domainId: domainRecord?.id ?? null,
    dataAreaId: dataAreaRecord?.id ?? null,
    domain: domainRecord,
    dataArea: dataAreaRecord,
  };
}

/**
 * Extract error message from unknown error type
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred";
}

/**
 * Check if error is a Zod validation error
 */
export function isZodError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ZodError"
  );
}

/**
 * Format Zod error for API response
 */
export function formatZodError(error: any): {
  message: string;
  details?: any;
  errors?: any;
} {
  return {
    message: "Invalid data provided",
    details: error.errors,
    errors: error.errors,
  };
}

/**
 * Standard error response handler
 */
export function handleError(error: unknown): {
  status: number;
  body: { message: string; details?: any; errors?: any };
} {
  if (isZodError(error)) {
    return {
      status: 400,
      body: formatZodError(error),
    };
  }
  
  const message = extractErrorMessage(error);
  
  // Check for common error types
  if (message.includes("not found")) {
    return { status: 404, body: { message } };
  }
  if (message.includes("already exists")) {
    return { status: 409, body: { message } };
  }
  if (message.includes("required") || message.includes("invalid") || message.includes("must be")) {
    return { status: 400, body: { message } };
  }
  
  return {
    status: 500,
    body: { message: message || "Internal server error" },
  };
}
