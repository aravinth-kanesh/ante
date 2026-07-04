import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy API calls to the backend in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
