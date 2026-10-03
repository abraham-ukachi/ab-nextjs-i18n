// next-intl request config (found automatically by `withAbI18n` / next-intl's plugin).
import { createAbRequestConfig } from 'ab-nextjs-i18n/server';
import abI18nConfig from './config';

export default createAbRequestConfig({
  config: abI18nConfig,
  // Keep this `import()` here so next-intl's (opt-in) precompile loader can see the JSON files.
  loadMessages: async (locale) => (await import(`{{MESSAGES_IMPORT}}/${locale}.json`)).default,
  // Next.js 16.3+: once your root layout is `app/[locale]/layout.tsx`, you can read the
  // locale from `next/root-params` (static rendering without `setRequestLocale`):
  //   import * as rootParams from 'next/root-params';
  //   rootParam: () => rootParams.locale(),
});
