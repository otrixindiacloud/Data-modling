import { describe, expect, it, vi } from "vitest";

vi.mock("openai", () => {
  return {
    default: class OpenAI {
      chat = { completions: { create: vi.fn() } };
    },
  };
});

vi.mock("../server/storage", () => ({
  storage: {},
}));

import { modelingAgentSchema } from "../server/services/modelingAgent";

describe("modelingAgentSchema", () => {
  it("normalizes SQL array values to newline-delimited strings", () => {
    const parsed = modelingAgentSchema.parse({
      summary: "Test summary",
      conceptualModel: { entities: [] },
      logicalModel: { entities: [] },
      physicalModel: { entities: [] },
      sql: {
        createStatements: [
          "CREATE TABLE alpha (id INT PRIMARY KEY)",
          "CREATE TABLE beta (id INT PRIMARY KEY)",
        ],
        dropStatements: "DROP TABLE obsolete;",
      },
    });

    expect(parsed.sql.createStatements).toBe(
      "CREATE TABLE alpha (id INT PRIMARY KEY)\nCREATE TABLE beta (id INT PRIMARY KEY)",
    );
    expect(parsed.sql.dropStatements).toBe("DROP TABLE obsolete;");
  });
});
