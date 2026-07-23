import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 10000,
    allowedHosts: ["contractiq-ai-2et9.onrender.com"],
  },
  preview: {
    host: true,
    port: 10000,
    strictPort: true,
  },
});
