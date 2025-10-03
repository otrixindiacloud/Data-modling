import type { System } from "@shared/schema";
import type { SystemFormValues } from "@/components/SystemForm";
import { mergeConnectionDefaults } from "@/lib/connectionTemplates";

function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && !Number.isNaN(item));
}

export function mapSystemToFormValues(system: System): SystemFormValues {
  const type = system.type ?? "sql";
  const domainIds = normalizeIds(system.configuration?.domainIds);
  const dataAreaIds = normalizeIds(system.configuration?.dataAreaIds);
  const primaryDomainId = domainIds.length
    ? domainIds[0]
    : typeof system.configuration?.domainId === "number"
      ? Number(system.configuration.domainId)
      : undefined;

  return {
    id: system.id,
    name: system.name ?? "",
    category: system.category ?? "",
    type,
    description: system.description ?? "",
    connectionString: system.connectionString ?? "",
    configuration: mergeConnectionDefaults(type, {
      ...(system.configuration || {}),
      domainId: primaryDomainId,
      domainIds,
      dataAreaIds,
      type,
    }),
    canBeSource: system.canBeSource ?? true,
    canBeTarget: system.canBeTarget ?? true,
    colorCode: system.colorCode ?? "#6366f1",
    domainIds,
    dataAreaIds,
    domainId: primaryDomainId,
  } satisfies SystemFormValues;
}

export function buildSystemRequestBody(values: SystemFormValues) {
  const domainIds = values.domainIds ?? (values.domainId ? [values.domainId] : []);
  const dataAreaIds = values.dataAreaIds ?? [];
  const domainId = values.domainId ?? domainIds[0];
  const mergedConfiguration = mergeConnectionDefaults(values.type, values.configuration);

  return {
    name: values.name,
    category: values.category,
    type: values.type,
    description: values.description,
    connectionString: values.connectionString,
    configuration: {
      ...mergedConfiguration,
      domainId,
      domainIds,
      dataAreaIds,
    },
    canBeSource: values.canBeSource ?? true,
    canBeTarget: values.canBeTarget ?? true,
    colorCode: values.colorCode,
  };
}
