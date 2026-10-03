// ===== AB I18N CONFIG ===== //
//
// Plain JS (no TS, no deps) so it can be imported from `next.config.*`, from
// `proxy.ts`, from the client, and by the CLI through the app's `i18n/config.ts`
// (Node strips the app's types, but never inside node_modules).


/** One year in seconds: the cookie lifetime once the user explicitly picks a locale. */
export const AB_LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The cookie name next-intl reads in its proxy/middleware. */
export const AB_LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/** Locale prefix modes supported in v1 (no domain routing). */
export const AB_LOCALE_PREFIXES = Object.freeze(['as-needed', 'always', 'never']);

/** The Ab defaults (God's locked decisions). */
export const AB_I18N_DEFAULTS = Object.freeze({
  locales: Object.freeze(['en', 'fr', 'es', 'ru']),
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeCookie: Object.freeze({ name: AB_LOCALE_COOKIE_NAME, maxAge: AB_LOCALE_COOKIE_MAX_AGE }),
  messagesDir: 'messages',
});

// Short BCP 47 tags: `en`, `fr`, `pt-BR`, `zh-Hant`, `es-419`...
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;


/**
 * Returns `true` if `value` looks like a BCP 47 locale tag that is safe to put
 * in a URL segment, a file name and a cookie.
 *
 * @param { unknown } value
 * @returns { boolean }
 */
export function isAbLocaleTag(value) {
  return typeof value === 'string' && LOCALE_PATTERN.test(value);
}


/**
 * Defines (validates + normalizes + freezes) the i18n config of an Ab app.
 *
 * @param { object } [input]
 * @returns { object } the normalized config
 */
export function defineAbI18n(input = {}) {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('[ab-nextjs-i18n] defineAbI18n() expects a config object.');
  }

  const locales = [...(input.locales ?? AB_I18N_DEFAULTS.locales)];
  if (locales.length === 0) throw new Error('[ab-nextjs-i18n] `locales` must contain at least one locale.');

  for (const locale of locales) {
    if (!isAbLocaleTag(locale)) {
      throw new Error(`[ab-nextjs-i18n] Invalid locale "${locale}". Use short BCP 47 tags such as "en", "fr" or "pt-BR".`);
    }
  }
  if (new Set(locales).size !== locales.length) {
    throw new Error(`[ab-nextjs-i18n] \`locales\` contains duplicates: ${locales.join(', ')}.`);
  }

  const defaultLocale = input.defaultLocale ?? (locales.includes(AB_I18N_DEFAULTS.defaultLocale) ? AB_I18N_DEFAULTS.defaultLocale : locales[0]);
  if (!locales.includes(defaultLocale)) {
    throw new Error(`[ab-nextjs-i18n] \`defaultLocale\` "${defaultLocale}" is not one of the locales (${locales.join(', ')}).`);
  }

  const sourceLocale = input.sourceLocale ?? defaultLocale;
  if (!locales.includes(sourceLocale)) {
    throw new Error(`[ab-nextjs-i18n] \`sourceLocale\` "${sourceLocale}" is not one of the locales (${locales.join(', ')}).`);
  }

  const localePrefix = input.localePrefix ?? AB_I18N_DEFAULTS.localePrefix;
  if (!AB_LOCALE_PREFIXES.includes(localePrefix)) {
    throw new Error(`[ab-nextjs-i18n] \`localePrefix\` must be one of ${AB_LOCALE_PREFIXES.join(', ')} (got "${localePrefix}").`);
  }

  let localeCookie = false;
  if (input.localeCookie !== false) {
    const cookie = input.localeCookie ?? {};
    const name = cookie.name ?? AB_LOCALE_COOKIE_NAME;
    const maxAge = cookie.maxAge ?? AB_LOCALE_COOKIE_MAX_AGE;
    if (typeof name !== 'string' || !/^[A-Za-z0-9_-]+$/.test(name)) {
      throw new Error(`[ab-nextjs-i18n] Invalid \`localeCookie.name\` "${name}".`);
    }
    if (!Number.isInteger(maxAge) || maxAge <= 0) {
      throw new Error('[ab-nextjs-i18n] `localeCookie.maxAge` must be a positive integer (seconds).');
    }
    localeCookie = Object.freeze({ name, maxAge });
  }

  const messagesDir = input.messagesDir ?? AB_I18N_DEFAULTS.messagesDir;
  if (typeof messagesDir !== 'string' || messagesDir.length === 0) {
    throw new Error('[ab-nextjs-i18n] `messagesDir` must be a non-empty string.');
  }

  const localeLabels = Object.freeze({ ...(input.localeLabels ?? {}) });

  return Object.freeze({
    locales: Object.freeze(locales),
    defaultLocale,
    sourceLocale,
    localePrefix,
    localeCookie,
    messagesDir,
    localeLabels,
  });
}


/**
 * Returns `true` if `value` is one of the config's locales (like next-intl's `hasLocale`).
 *
 * @param { { locales: readonly string[] } } config
 * @param { unknown } value
 * @returns { boolean }
 */
export function isAbLocale(config, value) {
  return typeof value === 'string' && config.locales.includes(value);
}


/**
 * Converts an Ab config into a next-intl routing config (pass it to `defineRouting`).
 *
 * The routing cookie (no `maxAge`) is what next-intl *reads* to pick the locale of
 * unprefixed URLs. `createAbI18nProxy` strips the cookie next-intl writes on plain
 * visits, so only an explicit pick writes it: `switchLocale` (one year by default) and
 * the action from `createAbLocaleCookieAction` (`config.localeCookie.maxAge`).
 *
 * @param { object } config
 * @returns { object }
 */
export function toAbRouting(config) {
  return {
    locales: [...config.locales],
    defaultLocale: config.defaultLocale,
    localePrefix: config.localePrefix,
    localeCookie: config.localeCookie ? { name: config.localeCookie.name, sameSite: 'lax' } : false,
  };
}


/**
 * Returns the locale encoded in the first segment of `pathname`, if any.
 *
 * @param { string } pathname
 * @param { { locales: readonly string[] } } config
 * @returns { string | undefined }
 */
export function getAbLocaleFromPathname(pathname, config) {
  const segment = String(pathname ?? '').split('/')[1];
  return isAbLocale(config, segment) ? segment : undefined;
}


/**
 * Removes the locale prefix from `pathname` (`/fr/about` → `/about`, `/fr` → `/`).
 *
 * @param { string } pathname
 * @param { { locales: readonly string[] } } config
 * @returns { string }
 */
export function stripAbLocalePrefix(pathname, config) {
  const value = pathname || '/';
  const locale = getAbLocaleFromPathname(value, config);
  if (!locale) return value.startsWith('/') ? value : `/${value}`;
  const rest = value.slice(locale.length + 1);
  return rest === '' ? '/' : rest;
}


/**
 * Returns the public pathname of `pathname` for `locale`, following `localePrefix`.
 * Any locale prefix already present on `pathname` is replaced.
 *
 * @param { string } pathname
 * @param { string } locale
 * @param { object } config
 * @param { { forcePrefix?: boolean } } [options]
 * @returns { string }
 */
export function localizeAbPathname(pathname, locale, config, options = {}) {
  const base = stripAbLocalePrefix(pathname, config);
  const prefixed = base === '/' ? `/${locale}` : `/${locale}${base}`;

  if (options.forcePrefix) return prefixed;
  if (config.localePrefix === 'never') return base;
  if (config.localePrefix === 'as-needed' && locale === config.defaultLocale) return base;
  return prefixed;
}


/**
 * Returns a human readable label for `locale` (via `Intl.DisplayNames`),
 * e.g. `getAbLocaleLabel('fr')` → `Français`, `getAbLocaleLabel('fr', 'en')` → `French`.
 *
 * @param { string } locale
 * @param { string } [displayLocale] - defaults to `locale` itself (native name)
 * @param { Record<string, string> } [overrides] - e.g. `config.localeLabels`
 * @returns { string }
 */
export function getAbLocaleLabel(locale, displayLocale, overrides) {
  if (overrides && typeof overrides[locale] === 'string') return overrides[locale];
  const inLocale = displayLocale ?? locale;
  try {
    const label = new Intl.DisplayNames([inLocale], { type: 'language', fallback: 'code' }).of(locale);
    if (!label) return locale;
    return label.charAt(0).toLocaleUpperCase(inLocale) + label.slice(1);
  } catch {
    return locale;
  }
}


/**
 * Serializes the locale cookie for `document.cookie`.
 * `persist: true` adds `max-age` (one year by default); otherwise it's a session cookie.
 * `secure: true` adds `Secure` (e.g. `location.protocol === 'https:'`).
 *
 * @param { string } locale
 * @param { object } config
 * @param { { persist?: boolean, path?: string, secure?: boolean } } [options]
 * @returns { string | null } `null` when the cookie is disabled
 */
export function serializeAbLocaleCookie(locale, config, options = {}) {
  if (!config.localeCookie) return null;
  if (!isAbLocaleTag(locale)) throw new Error(`[ab-nextjs-i18n] Invalid locale "${locale}".`);
  const parts = [`${config.localeCookie.name}=${locale}`, `path=${options.path ?? '/'}`, 'SameSite=Lax'];
  if (options.persist) parts.push(`max-age=${config.localeCookie.maxAge}`);
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}
