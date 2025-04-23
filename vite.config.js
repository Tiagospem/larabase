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
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.trace']
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'ui-components': ['highlight.js', 'marked', 'sql-formatter'],
          'database': ['uuid']
        }
      }
    },
    sourcemap: false
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer")
    }
  }
});
