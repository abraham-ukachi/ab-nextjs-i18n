// ===== AB I18N SERVER ===== //

import { getFormatter, getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { AbI18nConfig } from '../config';

export { createAbRequestConfig, resolveAbRequestLocale } from './ab-request-config';
export type { AbMessages, AbRequestConfigOptions } from './ab-request-config';
export { getAbAlternates } from './ab-alternates';
export type { AbAlternates, AbAlternatesOptions } from './ab-alternates';
export { getAbSitemapEntries } from './ab-sitemap';
export type { AbSitemapPath } from './ab-sitemap';
export { setAbLocaleCookie } from './ab-locale-cookie';
export type { AbLocaleCookieOptions } from './ab-locale-cookie';
export { setRequestLocale as setAbRequestLocale } from 'next-intl/server';


/**
 * `getTranslations` (next-intl): `getAbTranslations('Common')` or
 * `getAbTranslations({ locale, namespace: 'Metadata' })`.
 */
export const getAbTranslations = getTranslations;

/** `getLocale` (next-intl): the locale of the current request. */
export const getAbLocale = getLocale;

/** `getMessages` (next-intl): the messages of the current (or given) locale. */
export const getAbMessages = getMessages;

/** `getFormatter` (next-intl): dates, numbers, lists and relative times. */
export const getAbFormatter = getFormatter;


/**
 * `generateStaticParams` for `app/[locale]`: `[{ locale: 'en' }, { locale: 'fr' }, ...]`.
 */
export function generateAbStaticParams<L extends string>(config: AbI18nConfig<L>): Array<{ locale: L }> {
  return config.locales.map((locale) => ({ locale }));
}
