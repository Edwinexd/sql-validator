import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";

const emptyShim = path.resolve(__dirname, "src/shims/empty.ts");

// https://vite.dev/config/
export default defineConfig({
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
      // PGLite imports these Node subpaths which polyfill mocks don't support.
      // PGLite detects browser environment and doesn't actually use them.
      "stream/promises": emptyShim,
      "fs/promises": emptyShim,
    },
  },
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
});
