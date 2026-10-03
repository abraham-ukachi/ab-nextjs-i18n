import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // `server-only` throws outside the react-server condition: tests run the server code directly.
    alias: { 'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)) },
  },
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
