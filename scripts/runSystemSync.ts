import "dotenv/config";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../server/routes";

async function main() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const server = await registerRoutes(app);

  try {
    const response = await request(app)
      .post("/api/systems/36/sync-objects")
      .send({
        modelId: 59,
        direction: "source",
        includeAttributes: true,
      });

    console.log(
      JSON.stringify(
        {
          status: response.status,
          relationshipsCreated: response.body?.relationshipsCreated ?? 0,
          heuristicRelationshipsCreated: response.body?.heuristicRelationshipsCreated ?? 0,
          metadataCount: response.body?.metadataCount ?? 0,
          createdObjects: response.body?.createdCount ?? 0,
        },
        null,
        2,
      ),
    );
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
