// Type fixture: simulates an app whose `i18n/global.d.ts` narrows next-intl's
// `AppConfig` (what `init` writes). The library sources must still type-check.
// Used by `tsconfig.typed.json` (`pnpm run typecheck`).
import type messages from '../../templates/messages/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Locale: 'en' | 'fr' | 'es' | 'ru';
    Messages: typeof messages;
  }
}
