import type { ForeignKeyMetadata, TableMetadata } from "./dataConnectors";

function buildTableIndex(tables: TableMetadata[]): Map<string, TableMetadata> {
  const index = new Map<string, TableMetadata>();
  for (const table of tables) {
    const displayName = table.name?.toLowerCase();
    const originalName = table.originalName?.toLowerCase();
    const schema = table.schema?.toLowerCase();

    if (displayName) {
      index.set(displayName, table);
    }

    if (originalName) {
      index.set(originalName, table);
      if (schema) {
        index.set(`${schema}.${originalName}`, table);
      }
    }

    if (schema && displayName) {
      index.set(`${schema}.${displayName}`, table);
    }
  }
  return index;
}

function buildNameCandidates(base: string): string[] {
  const candidates = new Set<string>();
  const trimmed = base.replace(/[^a-z0-9_]/gi, "");
  candidates.add(trimmed);

  if (!trimmed.endsWith("s")) {
    candidates.add(`${trimmed}s`);
  }

  if (!trimmed.endsWith("es")) {
    candidates.add(`${trimmed}es`);
  }

  if (trimmed.endsWith("s")) {
    candidates.add(trimmed.replace(/s$/, ""));
  }

  if (trimmed.endsWith("ies")) {
    candidates.add(trimmed.replace(/ies$/, "y"));
  } else if (trimmed.endsWith("y") && trimmed.length > 1) {
    candidates.add(`${trimmed.slice(0, -1)}ies`);
  }

  if (trimmed.includes("_")) {
    const segments = trimmed.split("_").filter(Boolean);
    if (segments.length > 1) {
      candidates.add(segments[segments.length - 1]);
      candidates.add(segments.join(""));
    }
  }

  return Array.from(candidates).map((candidate) => candidate.toLowerCase());
}

function resolveReferencedColumn(table: TableMetadata): string | null {
  if (!Array.isArray(table.columns)) {
    return null;
  }

  const idColumn = table.columns.find((column) => column.name.toLowerCase() === "id");
  if (idColumn) {
    return idColumn.name;
  }

  const primary = table.columns.find((column) => column.isPrimaryKey);
  if (primary) {
    return primary.name;
  }

  return null;
}

export function generateHeuristicForeignKeys(
  table: TableMetadata,
  allTables: TableMetadata[],
  existingForeignKeys: ForeignKeyMetadata[] = [],
): ForeignKeyMetadata[] {
  if (!Array.isArray(table.columns) || table.columns.length === 0) {
    return [];
  }

  const index = buildTableIndex(allTables);
  const existingColumnRefs = new Set<string>();
  for (const foreignKey of existingForeignKeys) {
    for (const column of foreignKey.columns ?? []) {
      existingColumnRefs.add(column.toLowerCase());
    }
  }

  const results: ForeignKeyMetadata[] = [];
  const seen = new Set<string>();

  for (const column of table.columns) {
    if (!column?.name) {
      continue;
    }

    const normalizedName = column.name.toLowerCase();
    if (existingColumnRefs.has(normalizedName)) {
      continue;
    }

    if (column.isPrimaryKey || normalizedName === "id") {
      continue;
    }

    if (normalizedName.endsWith("uuid") || normalizedName.endsWith("guid")) {
      continue;
    }

    let base: string | null = null;
    if (normalizedName.endsWith("_id")) {
      base = normalizedName.slice(0, -3);
    } else if (normalizedName.endsWith("id")) {
      base = normalizedName.slice(0, -2);
    }

    if (!base || base.length < 2) {
      continue;
    }

    const candidates = buildNameCandidates(base);
    let matchedTable: TableMetadata | undefined;
    const schemaPrefix = table.schema ? `${table.schema.toLowerCase()}.` : null;
    for (const candidate of candidates) {
      matchedTable = index.get(candidate);
      if (!matchedTable && schemaPrefix) {
        matchedTable = index.get(`${schemaPrefix}${candidate}`);
      }
      if (matchedTable) {
        break;
      }
    }

    if (!matchedTable) {
      continue;
    }

    if (matchedTable.name?.toLowerCase() === table.name?.toLowerCase()) {
      continue;
    }

    const referencedColumn = resolveReferencedColumn(matchedTable);
    if (!referencedColumn) {
      continue;
    }

    const dedupeKey = `${normalizedName}|${matchedTable.name?.toLowerCase() ?? "unknown"}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    results.push({
      constraintName: `heuristic_fk_${table.name}_${column.name}`.toLowerCase(),
      columns: [column.name],
      referencedTable: matchedTable.name,
      referencedSchema: matchedTable.schema,
      referencedColumns: [referencedColumn],
      relationshipType: "N:1",
    });
  }

  return results;
}
