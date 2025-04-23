import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  base: "./",
  root: path.resolve(__dirname, "src/renderer"),
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.debug", "console.trace"]
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split vendors into separate chunks to improve caching
          if (id.includes("node_modules")) {
            if (id.includes("vue")) {
              return "vendor-vue";
            } else if (id.includes("highlight.js") || id.includes("marked") || id.includes("sql-formatter")) {
              return "vendor-formatters";
            } else if (id.includes("pinia") || id.includes("vue-router")) {
              return "vendor-framework";
            } else {
              return "vendor";
            }
          }
        }
      }
    },
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer")
    }
  }
});
