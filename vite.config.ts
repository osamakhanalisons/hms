import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8021,
    allowedHosts: ["hms.alisonstech-dev.com"],
  },

  plugins: [
    tanstackStart({
      server: {
        experimental: {
          asyncContext: true,
        },
      },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
});