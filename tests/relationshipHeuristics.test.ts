import { describe, expect, it } from "vitest";
import type { TableMetadata, ForeignKeyMetadata } from "../server/services/dataConnectors";
import { generateHeuristicForeignKeys } from "../server/services/relationshipHeuristics";

describe("generateHeuristicForeignKeys", () => {
  const customersTable: TableMetadata = {
    name: "customers",
    originalName: "customers",
    schema: "public",
    columns: [
      { name: "id", type: "UUID", nullable: false, isPrimaryKey: true },
      { name: "name", type: "TEXT", nullable: false, isPrimaryKey: false },
    ],
  };

  const storesTable: TableMetadata = {
    name: "stores",
    originalName: "stores",
    schema: "public",
    columns: [
      { name: "id", type: "UUID", nullable: false, isPrimaryKey: true },
      { name: "name", type: "TEXT", nullable: false, isPrimaryKey: false },
    ],
  };

  it("infers single foreign key columns ending with _id", () => {
    const ordersTable: TableMetadata = {
      name: "online_orders",
      originalName: "online_orders",
      schema: "public",
      columns: [
        { name: "id", type: "UUID", nullable: false, isPrimaryKey: true },
        { name: "customer_id", type: "UUID", nullable: false, isPrimaryKey: false },
        { name: "status", type: "TEXT", nullable: false, isPrimaryKey: false },
      ],
    };

    const result = generateHeuristicForeignKeys(ordersTable, [ordersTable, customersTable]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      columns: ["customer_id"],
      referencedTable: "customers",
      referencedColumns: ["id"],
      relationshipType: "N:1",
      constraintName: expect.stringContaining("heuristic_fk_online_orders_customer_id"),
    });
  });

  it("handles pluralization and multiple candidates", () => {
    const ordersTable: TableMetadata = {
      name: "orders",
      originalName: "orders",
      schema: "public",
      columns: [
        { name: "id", type: "UUID", nullable: false, isPrimaryKey: true },
        { name: "status", type: "TEXT", nullable: false, isPrimaryKey: false },
      ],
    };

    const orderItemsTable: TableMetadata = {
      name: "order_items",
      originalName: "order_items",
      schema: "public",
      columns: [
        { name: "id", type: "UUID", nullable: false, isPrimaryKey: true },
        { name: "order_id", type: "UUID", nullable: false, isPrimaryKey: false },
        { name: "store_id", type: "UUID", nullable: false, isPrimaryKey: false },
        { name: "quantity", type: "INT", nullable: false, isPrimaryKey: false },
      ],
    };

    const result = generateHeuristicForeignKeys(orderItemsTable, [orderItemsTable, ordersTable, storesTable]);

    const sorted = result
      .slice()
      .sort((a, b) => a.columns[0].localeCompare(b.columns[0]));
    expect(sorted).toHaveLength(2);
    expect(sorted[0]).toMatchObject({
      columns: ["order_id"],
      referencedTable: "orders",
    });
    expect(sorted[1]).toMatchObject({
      columns: ["store_id"],
      referencedTable: "stores",
    });
  });

  it("skips columns already covered by explicit foreign keys", () => {
    const table: TableMetadata = {
      name: "transactions",
      originalName: "transactions",
      schema: "public",
      columns: [
        { name: "id", type: "UUID", nullable: false, isPrimaryKey: true },
        { name: "store_id", type: "UUID", nullable: false, isPrimaryKey: false },
      ],
    };

    const existingForeignKeys: ForeignKeyMetadata[] = [
      {
        constraintName: "transactions_store_id_fkey",
        columns: ["store_id"],
        referencedTable: "stores",
        referencedColumns: ["id"],
        relationshipType: "N:1",
      },
    ];

    const result = generateHeuristicForeignKeys(table, [table, storesTable], existingForeignKeys);
    expect(result).toHaveLength(0);
  });

  it("avoids false positives when no matching table exists", () => {
    const prescriptionsTable: TableMetadata = {
      name: "prescriptions",
      originalName: "prescriptions",
      schema: "public",
      columns: [
        { name: "id", type: "UUID", nullable: false, isPrimaryKey: true },
        { name: "notes", type: "TEXT", nullable: true, isPrimaryKey: false },
      ],
    };

    const ordersTable: TableMetadata = {
      name: "orders",
      originalName: "orders",
      schema: "public",
      columns: [
        { name: "id", type: "UUID", nullable: false, isPrimaryKey: true },
        { name: "status_id", type: "UUID", nullable: true, isPrimaryKey: false },
      ],
    };

    const result = generateHeuristicForeignKeys(ordersTable, [ordersTable, prescriptionsTable]);
    expect(result).toHaveLength(0);
  });
});
