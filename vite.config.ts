import { defineConfig } from "vitest/config";

export default defineConfig({
  // relative base so the build works on GitHub Pages under /will-it-fit/ and from any folder
  base: "./",
  worker: { format: "es" },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 60000,
  },
});
