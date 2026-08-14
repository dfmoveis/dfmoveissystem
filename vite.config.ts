import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          enabled: true,
        },
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
});
