import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    exclude: ["node_modules/**", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: { lines: 80 },
      exclude: [
        "node_modules/**",
        "**/*.config.*",
        "app/layout.tsx",
        "vitest.setup.ts",
        "e2e/**",
        "middleware.ts",
      ],
    },
  },
});
