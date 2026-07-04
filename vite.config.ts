import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

// https://vite.dev/config/
// APP_BASE is set per compatibility snapshot by scripts/build-deploy.mjs so each
// dated build is served (and isolated) under /compatibility/<date>/. Unset = "/".
export default defineConfig({
  base: process.env.APP_BASE || "/",
  plugins: [
    react(),
    nodePolyfills({
      // Enable polyfills for specific modules
      // Needed for sql.js
      include: ["fs", "stream", "crypto", "buffer", "path", "util"],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: "build",
  },
  assetsInclude: ["**/*.wasm"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
