import { describe, expect, it } from 'vitest';
import {
  AB_LOCALE_COOKIE_MAX_AGE,
  defineAbI18n,
  getAbLocaleFromPathname,
  getAbLocaleLabel,
  isAbLocale,
  localizeAbPathname,
  serializeAbLocaleCookie,
  stripAbLocalePrefix,
  toAbRouting,
} from '../config';
import { getAbNextIntlPluginConfig, withAbI18n } from '../plugin';
import { generateAbStaticParams, getAbAlternates, getAbSitemapEntries, resolveAbRequestLocale } from '../server';
import { pickAbNamespaces } from '../ab-i18n-provider';

const config = defineAbI18n();

describe('defineAbI18n', () => {
  it('applies the Ab defaults (en, fr, es, ru · as-needed · NEXT_LOCALE)', () => {
    expect(config.locales).toEqual(['en', 'fr', 'es', 'ru']);
    expect(config.defaultLocale).toBe('en');
    expect(config.sourceLocale).toBe('en');
    expect(config.localePrefix).toBe('as-needed');
    expect(config.localeCookie).toEqual({ name: 'NEXT_LOCALE', maxAge: 31536000 });
    expect(AB_LOCALE_COOKIE_MAX_AGE).toBe(31536000);
    expect(config.messagesDir).toBe('messages');
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('validates its input', () => {
    expect(() => defineAbI18n({ locales: [] })).toThrow(/at least one/);
    expect(() => defineAbI18n({ locales: ['en', 'en'] })).toThrow(/duplicates/);
    expect(() => defineAbI18n({ locales: ['en', 'FR'] })).toThrow(/Invalid locale/);
    expect(() => defineAbI18n({ locales: ['en', 'fr'], defaultLocale: 'de' as any })).toThrow(/defaultLocale/);
    expect(() => defineAbI18n({ localePrefix: 'domains' as any })).toThrow(/localePrefix/);
    expect(() => defineAbI18n({ localeCookie: { maxAge: -1 } })).toThrow(/maxAge/);
    expect(defineAbI18n({ locales: ['de', 'pt-BR'] }).defaultLocale).toBe('de');
    expect(defineAbI18n({ localeCookie: false }).localeCookie).toBe(false);
  });

  it('converts to a next-intl routing config with a session cookie', () => {
    expect(toAbRouting(config)).toEqual({
      locales: ['en', 'fr', 'es', 'ru'],
      defaultLocale: 'en',
      localePrefix: 'as-needed',
      localeCookie: { name: 'NEXT_LOCALE', sameSite: 'lax' },
    });
    expect(toAbRouting(defineAbI18n({ localeCookie: false })).localeCookie).toBe(false);
    expect(isAbLocale(config, 'fr')).toBe(true);
    expect(isAbLocale(config, 'de')).toBe(false);
  });
});

describe('pathname helpers', () => {
  it('reads and strips locale prefixes', () => {
    expect(getAbLocaleFromPathname('/fr/about', config)).toBe('fr');
    expect(getAbLocaleFromPathname('/about', config)).toBeUndefined();
    expect(stripAbLocalePrefix('/fr/about', config)).toBe('/about');
    expect(stripAbLocalePrefix('/fr', config)).toBe('/');
    expect(stripAbLocalePrefix('/french', config)).toBe('/french');
  });

  it('localizes pathnames for every prefix mode', () => {
    expect(localizeAbPathname('/about', 'en', config)).toBe('/about');
    expect(localizeAbPathname('/fr/about', 'en', config)).toBe('/about');
    expect(localizeAbPathname('/about', 'fr', config)).toBe('/fr/about');
    expect(localizeAbPathname('/', 'ru', config)).toBe('/ru');
    expect(localizeAbPathname('/about', 'en', config, { forcePrefix: true })).toBe('/en/about');
    const always = defineAbI18n({ localePrefix: 'always' });
    expect(localizeAbPathname('/es/about', 'en', always)).toBe('/en/about');
    const never = defineAbI18n({ localePrefix: 'never' });
    expect(localizeAbPathname('/es/about', 'fr', never)).toBe('/about');
  });
});

describe('labels and cookies', () => {
  it('returns native labels, translated labels and overrides', () => {
    expect(getAbLocaleLabel('fr')).toBe('Français');
    expect(getAbLocaleLabel('fr', 'en')).toBe('French');
    expect(getAbLocaleLabel('ru')).toBe('Русский');
    expect(getAbLocaleLabel('es', 'es', { es: 'Castellano' })).toBe('Castellano');
  });

  it('writes a session cookie unless the pick is persisted (1 year)', () => {
    expect(serializeAbLocaleCookie('fr', config)).toBe('NEXT_LOCALE=fr; path=/; SameSite=Lax');
    expect(serializeAbLocaleCookie('fr', config, { persist: true })).toBe('NEXT_LOCALE=fr; path=/; SameSite=Lax; max-age=31536000');
    expect(serializeAbLocaleCookie('fr', config, { persist: true, secure: true })).toBe('NEXT_LOCALE=fr; path=/; SameSite=Lax; max-age=31536000; Secure');
    expect(serializeAbLocaleCookie('fr', defineAbI18n({ localeCookie: false }))).toBeNull();
    expect(() => serializeAbLocaleCookie('fr; evil=1', config)).toThrow(/Invalid locale/);
  });
});

describe('server helpers', () => {
  it('generates static params, alternates and sitemap entries', () => {
    expect(generateAbStaticParams(config)).toEqual([{ locale: 'en' }, { locale: 'fr' }, { locale: 'es' }, { locale: 'ru' }]);
    expect(getAbAlternates(config, '/about', { locale: 'fr' })).toEqual({
      canonical: '/fr/about',
      languages: { en: '/about', fr: '/fr/about', es: '/es/about', ru: '/ru/about', 'x-default': '/about' },
    });
    const entries = getAbSitemapEntries(config, ['/', { path: '/docs', priority: 0.5 }], 'https://example.com');
    expect(entries).toHaveLength(8);
    expect(entries[1]).toMatchObject({ url: 'https://example.com/fr', alternates: { languages: { en: 'https://example.com/' } } });
    expect(entries[4]).toMatchObject({ url: 'https://example.com/docs', priority: 0.5 });
  });

  it('resolves the request locale: override → root param → proxy → default', async () => {
    expect(await resolveAbRequestLocale(config, { locale: 'es', requestLocale: Promise.resolve('fr') })).toBe('es');
    expect(await resolveAbRequestLocale(config, { requestLocale: Promise.resolve('fr') }, () => 'ru')).toBe('ru');
    const throwing = () => {
      throw new Error('root params are not available in Server Actions');
    };
    expect(await resolveAbRequestLocale(config, { requestLocale: Promise.resolve('fr') }, throwing)).toBe('fr');
    expect(await resolveAbRequestLocale(config, { requestLocale: Promise.resolve('xx') })).toBe('en');
  });

  it('picks namespaces for the client provider', () => {
    expect(pickAbNamespaces({ App: { a: 1 }, Common: { b: 2 }, Theme: {} }, ['Common', 'Missing'])).toEqual({ Common: { b: 2 } });
  });
});

describe('withAbI18n', () => {
  it('keeps precompile off by default and enables it on demand', () => {
    expect(getAbNextIntlPluginConfig()).toEqual({});
    expect(getAbNextIntlPluginConfig({ precompile: true, config })).toEqual({
      experimental: { messages: { format: 'json', path: './messages', locales: ['en', 'fr', 'es', 'ru'], sourceLocale: 'en', precompile: true } },
    });
  });

  it('adds ab-nextjs-i18n to transpilePackages and keeps the user config', () => {
    const result = withAbI18n({ reactStrictMode: true, transpilePackages: ['ab-nextjs-theme'] }, { requestConfig: './i18n/request.ts' });
    expect(result.reactStrictMode).toBe(true);
    expect(result.transpilePackages).toEqual(['ab-nextjs-theme', 'ab-nextjs-i18n']);
  });
});
