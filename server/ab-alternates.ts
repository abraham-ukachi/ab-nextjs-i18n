// ===== AB ALTERNATES (hreflang) ===== //

import { localizeAbPathname } from '../config';
import type { AbI18nConfig } from '../config';

export interface AbAlternatesOptions<L extends string = string> {
  /** Adds `canonical` for this locale. */
  locale?: L;
  /** Makes every URL absolute (e.g. `https://example.com`). Otherwise use `metadataBase`. */
  baseUrl?: string;
}

export interface AbAlternates {
  canonical?: string;
  languages: Record<string, string>;
}

function withBase(pathname: string, baseUrl?: string): string {
  return baseUrl ? new URL(pathname, baseUrl).toString() : pathname;
}


/**
 * Returns Next.js `metadata.alternates` for `pathname` (without locale prefix):
 * one `languages` entry per locale plus `x-default`.
 */
export function getAbAlternates<L extends string>(
  config: AbI18nConfig<L>,
  pathname: string,
  options: AbAlternatesOptions<L> = {},
): AbAlternates {
  const languages: Record<string, string> = {};
  for (const locale of config.locales) {
    languages[locale] = withBase(localizeAbPathname(pathname, locale, config), options.baseUrl);
  }
  languages['x-default'] = withBase(localizeAbPathname(pathname, config.defaultLocale, config), options.baseUrl);

  const alternates: AbAlternates = { languages };
  if (options.locale) alternates.canonical = withBase(localizeAbPathname(pathname, options.locale, config), options.baseUrl);
  return alternates;
}
