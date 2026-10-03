// ===== AB I18N (client & shared) ===== //

import type { AbI18nCatalogEntry } from './types/catalog';

export { default as AbI18nProvider, pickAbNamespaces } from './ab-i18n-provider';
export type { AbI18nProviderProps } from './ab-i18n-provider';
export { AbI18nConfigProvider, useAbI18nConfig } from './ab-i18n-provider/ab-i18n-config-context';
export { useAbLocaleSwitch } from './use-ab-locale-switch';
export type { AbLocaleSwitch, AbSwitchLocaleOptions } from './use-ab-locale-switch';
export { useAbFormatter, useAbLocale, useAbMessages, useAbTranslations } from './hooks';
export {
  AB_I18N_DEFAULTS,
  AB_LOCALE_COOKIE_MAX_AGE,
  AB_LOCALE_COOKIE_NAME,
  defineAbI18n,
  getAbLocaleFromPathname,
  getAbLocaleLabel,
  isAbLocale,
  localizeAbPathname,
  stripAbLocalePrefix,
} from './config';
export type { AbI18nConfig, AbI18nConfigInput, AbLocale, AbLocalePrefix } from './config';
export type { AbI18nCatalogEntry } from './types/catalog';


/** Every public API of `ab-nextjs-i18n` and its status (used by the README tables and tests). */
export const supportedApis: AbI18nCatalogEntry[] = [
  // client & shared (`ab-nextjs-i18n`)
  { name: 'AbI18nProvider', entry: 'ab-nextjs-i18n', file: 'ab-i18n-provider/index.tsx', kind: 'component', status: 'Done' },
  { name: 'useAbLocaleSwitch', entry: 'ab-nextjs-i18n', file: 'use-ab-locale-switch/index.ts', kind: 'hook', status: 'Done' },
  { name: 'useAbTranslations', entry: 'ab-nextjs-i18n', file: 'hooks/index.ts', kind: 'hook', status: 'Done' },
  { name: 'useAbLocale', entry: 'ab-nextjs-i18n', file: 'hooks/index.ts', kind: 'hook', status: 'Done' },
  { name: 'useAbFormatter', entry: 'ab-nextjs-i18n', file: 'hooks/index.ts', kind: 'hook', status: 'Done' },
  { name: 'useAbMessages', entry: 'ab-nextjs-i18n', file: 'hooks/index.ts', kind: 'hook', status: 'Done' },
  { name: 'useAbI18nConfig', entry: 'ab-nextjs-i18n', file: 'ab-i18n-provider/ab-i18n-config-context.tsx', kind: 'hook', status: 'Done' },
  { name: 'getAbLocaleLabel', entry: 'ab-nextjs-i18n', file: 'config.js', kind: 'function', status: 'Done' },
  // config (`ab-nextjs-i18n/config`)
  { name: 'defineAbI18n', entry: 'ab-nextjs-i18n/config', file: 'config.js', kind: 'function', status: 'Done' },
  { name: 'toAbRouting', entry: 'ab-nextjs-i18n/config', file: 'config.js', kind: 'function', status: 'Done' },
  { name: 'localizeAbPathname', entry: 'ab-nextjs-i18n/config', file: 'config.js', kind: 'function', status: 'Done' },
  { name: 'stripAbLocalePrefix', entry: 'ab-nextjs-i18n/config', file: 'config.js', kind: 'function', status: 'Done' },
  // server (`ab-nextjs-i18n/server`)
  { name: 'createAbRequestConfig', entry: 'ab-nextjs-i18n/server', file: 'server/ab-request-config.ts', kind: 'function', status: 'Done' },
  { name: 'getAbTranslations', entry: 'ab-nextjs-i18n/server', file: 'server/index.ts', kind: 'function', status: 'Done' },
  { name: 'getAbLocale', entry: 'ab-nextjs-i18n/server', file: 'server/index.ts', kind: 'function', status: 'Done' },
  { name: 'getAbMessages', entry: 'ab-nextjs-i18n/server', file: 'server/index.ts', kind: 'function', status: 'Done' },
  { name: 'getAbFormatter', entry: 'ab-nextjs-i18n/server', file: 'server/index.ts', kind: 'function', status: 'Done' },
  { name: 'generateAbStaticParams', entry: 'ab-nextjs-i18n/server', file: 'server/index.ts', kind: 'function', status: 'Done' },
  { name: 'getAbAlternates', entry: 'ab-nextjs-i18n/server', file: 'server/ab-alternates.ts', kind: 'function', status: 'Done' },
  { name: 'getAbSitemapEntries', entry: 'ab-nextjs-i18n/server', file: 'server/ab-sitemap.ts', kind: 'function', status: 'Done' },
  { name: 'setAbLocaleCookie', entry: 'ab-nextjs-i18n/server', file: 'server/ab-locale-cookie.ts', kind: 'server-action', status: 'Done' },
  // navigation, proxy & plugin
  { name: 'createAbNavigation', entry: 'ab-nextjs-i18n/navigation', file: 'navigation/index.ts', kind: 'function', status: 'Done' },
  { name: 'createAbI18nProxy', entry: 'ab-nextjs-i18n/proxy', file: 'proxy/index.ts', kind: 'function', status: 'Done' },
  { name: 'withAbI18n', entry: 'ab-nextjs-i18n/plugin', file: 'plugin.js', kind: 'function', status: 'Done' },
];


/** The `abI18n` catalog (default export). */
const abI18n = { supportedApis };

export { abI18n };
export default abI18n;
