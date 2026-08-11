import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
const R = "/Users/christo/Code/HA_Portal";
export default defineConfig({
  root: R,
  configFile: false,
  // Components import "../store.svelte"; views import "../lib/store.svelte".
  // Aliasing only the first left Security.svelte wired to the REAL store, which
  // has no entities under SSR — so the grid rendered zero rows and the test was
  // measuring nothing.
  resolve: { alias: [
    { find: /^\.\.\/(lib\/)?store\.svelte$/, replacement: R + "/.ssrcheck/stub-store.ts" },
    { find: /^\.\.\/(lib\/)?toast\.svelte$/, replacement: R + "/.ssrcheck/stub-toast.ts" },
  ]},
  plugins: [svelte({ configFile: false, compilerOptions: { generate: "server" } })],
  build: { outDir: R + "/.ssrcheck/out", emptyOutDir: true, minify: false, ssr: true,
           rollupOptions: {
             input: { entry: R + "/.ssrcheck/entry.ts", security: R + "/.ssrcheck/entry-security.ts" },
             output: { format: "esm", entryFileNames: "[name].mjs" },
           } },
});
