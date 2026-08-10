import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
const R = "/Users/christo/Code/HA_Portal";
export default defineConfig({
  root: R,
  configFile: false,
  resolve: { alias: [
    { find: /^\.\.\/store\.svelte$/, replacement: R + "/.ssrcheck/stub-store.ts" },
    { find: /^\.\.\/toast\.svelte$/, replacement: R + "/.ssrcheck/stub-toast.ts" },
  ]},
  plugins: [svelte({ configFile: false, compilerOptions: { generate: "server" } })],
  build: { ssr: R + "/.ssrcheck/entry.ts", outDir: R + "/.ssrcheck/out",
           emptyOutDir: true, minify: false,
           rollupOptions: { output: { format: "esm", entryFileNames: "entry.mjs" } } },
});
