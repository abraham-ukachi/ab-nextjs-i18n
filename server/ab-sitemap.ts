// ===== AB SITEMAP ===== //

import type { MetadataRoute } from 'next';
import { localizeAbPathname } from '../config';
import type { AbI18nConfig } from '../config';

export type AbSitemapPath = string | ({ path: string } & Omit<MetadataRoute.Sitemap[number], 'url' | 'alternates'>);


/**
 * Returns `app/sitemap.ts` entries: one entry per path and locale, each with
 * `alternates.languages` pointing at every locale.
 */
export function getAbSitemapEntries<L extends string>(
  config: AbI18nConfig<L>,
  paths: readonly AbSitemapPath[],
  baseUrl: string,
): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const item of paths) {
    const { path, ...rest } = typeof item === 'string' ? { path: item } : item;
    const languages: Record<string, string> = {};
    for (const locale of config.locales) {
      languages[locale] = new URL(localizeAbPathname(path, locale, config), baseUrl).toString();
    }
    for (const locale of config.locales) {
      entries.push({ ...rest, url: languages[locale], alternates: { languages } });
    }
  }

  return entries;
}
