import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["motion/react"],
          icons: ["@phosphor-icons/react"]
        }
      }
    }
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["vendor/**", "runtime/**", "node_modules/**"]
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: { clientFiles: ["./src/main.tsx"] }
  },
  plugins: [react()]
});
