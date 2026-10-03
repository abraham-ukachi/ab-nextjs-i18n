// i18n config: the single source of truth for locales (used by the app, the proxy and the ab-nextjs-i18n CLI).
// Keep this file free of TypeScript-only runtime syntax (enums, namespaces): the CLI imports it with Node's type stripping.
import { defineAbI18n } from 'ab-nextjs-i18n/config';

export const abI18nConfig = defineAbI18n({
  locales: [{{LOCALES}}],
  defaultLocale: '{{DEFAULT_LOCALE}}',
  // 'as-needed': the default locale lives at `/`, the others at `/fr`, `/es`...
  localePrefix: '{{PREFIX}}',
  // Only written when the user picks a locale (switchLocale / setAbLocaleCookie), for maxAge (one year).
  localeCookie: { name: 'NEXT_LOCALE', maxAge: 60 * 60 * 24 * 365 },
  messagesDir: '{{MESSAGES_DIR}}',
});

export type AppLocale = (typeof abI18nConfig.locales)[number];

export default abI18nConfig;
