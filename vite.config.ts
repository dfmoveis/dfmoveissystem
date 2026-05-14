// SPA build (no SSR, no Cloudflare Worker) — para deploy estático na Vercel.
// O preview/dev do Lovable continua funcionando porque o plugin Cloudflare
// do wrapper só é injetado durante `command === "build"`, e nós o desabilitamos.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: {
        enabled: true,
      },
    },
  },
});
