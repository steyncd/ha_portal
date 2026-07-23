import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    // PWA: precache the hashed app shell so repeat loads are instant + offline,
    // and the portal is installable. Coexists with the FCM service worker
    // (firebase-messaging-sw.js) — excluded from precache; /api/* not intercepted.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "HA Portal",
        short_name: "HA Portal",
        description: "Steyn home — Home Assistant portal",
        theme_color: "#0b1017",
        background_color: "#0b1017",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /firebase-messaging-sw\.js$/],
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        globIgnores: ["firebase-messaging-sw.js"],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Split the Firebase SDK into its own chunk: parsed in parallel with the
        // app entry and cached across app deploys (it changes far less often).
        manualChunks(id) {
          // Messaging (FCM push) is only used from Settings → keep it OUT of the
          // eager firebase chunk so it loads lazily with the push flow.
          if (id.includes("firebase/messaging") || id.includes("@firebase/messaging")) return "firebase-messaging";
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) return "firebase";
        },
      },
    },
  },
});
