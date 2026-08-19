import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // .env.local lives at the monorepo root, not here — Vite otherwise only
  // looks in this package's own directory for .env* files.
  envDir: "../../",
  server: {
    host: "0.0.0.0",
  },
});
