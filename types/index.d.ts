// ===== AB I18N - TYPES ===== //
//
// `types` entry for tools that ignore `exports` (TS `moduleResolution: node`).
// With `bundler` / `node16` resolution, TypeScript reads `index.ts` directly.

export * from '../index';
export { default } from '../index';
export type { AbI18nCatalogEntry } from './catalog';
export type { AbI18nConfig, AbI18nConfigInput, AbLocale, AbLocaleCookie, AbLocalePrefix } from '../config';
