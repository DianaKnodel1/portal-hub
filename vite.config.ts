// Self-hosted Build-Konfiguration:
// Wir deaktivieren den Cloudflare-Workers-Plugin (cloudflare: false), damit
// das Projekt als normaler Node-/Bun-Server gebaut wird. Das Output landet
// in .output/server/index.mjs und wird via `bun run start` gestartet.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    // SSR-Entry bleibt unsere eigene src/server.ts (Error-Wrapper).
    server: { entry: "server" },
  },
});
