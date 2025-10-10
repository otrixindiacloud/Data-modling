import { storage } from "../storage";
import { insertConfigurationSchema } from "@shared/schema";

export async function upsertConfigurationEntry(input: unknown) {
  const validatedData = insertConfigurationSchema.parse(input);
  const existing = await storage.getConfigurationByCategoryAndKey(
    validatedData.category,
    validatedData.key
  );

  const fallbackDescription = `${validatedData.category}.${validatedData.key} configuration`;

  if (existing) {
    const updated = await storage.updateConfiguration(existing.id, {
      value: validatedData.value,
      description:
        validatedData.description ?? existing.description ?? fallbackDescription,
    });

    return { configuration: updated, created: false as const };
  }

  const created = await storage.createConfiguration(validatedData);
  return { configuration: created, created: true as const };
}
