import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // `scripts/` y entre avec le garde fail-open (lot D du plan parc-et-gardes) : il ne
    // vit pas sous src/, et sans cette ligne son test ne serait jamais execute.
    include: ["src/**/*.test.ts", "app/**/*.test.ts", "scripts/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});