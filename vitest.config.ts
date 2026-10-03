import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    server: {
      deps: {
        // next-intl's ESM imports `next/server` without an extension (Next.js has no
        // exports map): let Vite resolve it instead of Node's strict ESM loader.
        inline: ['next-intl'],
      },
    },
  },
});
