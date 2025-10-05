import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = new URL("./", import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./client/src", rootDir)),
      "@shared": fileURLToPath(new URL("./shared", rootDir))
    }
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    restoreMocks: true,
    isolate: false,
    environmentMatchGlobs: [
      ["tests/ui/**/*.test.tsx", "happy-dom"]
    ]
  }
});