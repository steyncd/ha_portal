import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";

// Separate from vite.config.ts so the PWA plugin doesn't run under test. The
// Svelte plugin is included so `.svelte`/`.svelte.ts` (runes) can be imported;
// pure logic lives in Firebase-free `.ts` modules that need neither.
export default defineConfig({
  plugins: [svelte({ hot: false }), svelteTesting()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,js}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.svelte.ts", "src/**/*.d.ts"],
    },
  },
});
