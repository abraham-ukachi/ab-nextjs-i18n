// ===== AB I18N CONFIG - TYPES ===== //

/** A locale tag such as `en`, `fr` or `pt-BR`. */
export type AbLocale = string;

/** How locales show up in the URL (v1: prefixes only, no domains). */
export type AbLocalePrefix = 'as-needed' | 'always' | 'never';

export interface AbLocaleCookieInput {
  /** Cookie name. Defaults to `NEXT_LOCALE`. */
  name?: string;
  /** Lifetime (seconds) once the user explicitly picks a locale. Defaults to one year. */
  maxAge?: number;
}

export interface AbLocaleCookie {
  readonly name: string;
  readonly maxAge: number;
}

export interface AbI18nConfigInput<L extends string = string> {
  /** Defaults to `['en', 'fr', 'es', 'ru']`. */
  locales?: readonly L[];
  /** Defaults to `en` (or the first locale). */
  defaultLocale?: NoInfer<L>;
  /** Defaults to `'as-needed'` (default locale at `/`, others at `/fr`...). */
  localePrefix?: AbLocalePrefix;
  /** Defaults to `{ name: 'NEXT_LOCALE', maxAge: 31536000 }`; `false` disables it. */
  localeCookie?: AbLocaleCookieInput | false;
  /** Folder (relative to the app root) holding `<locale>.json`. Defaults to `messages`. */
  messagesDir?: string;
  /** Locale the CLI translates from. Defaults to `defaultLocale`. */
  sourceLocale?: NoInfer<L>;
  /** Optional label overrides used by `getAbLocaleLabel` / `useAbLocaleSwitch`. */
  localeLabels?: Partial<Record<L, string>>;
}

export interface AbI18nConfig<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly sourceLocale: L;
  readonly localePrefix: AbLocalePrefix;
  readonly localeCookie: AbLocaleCookie | false;
  readonly messagesDir: string;
  readonly localeLabels: Readonly<Partial<Record<L, string>>>;
}

/** The next-intl routing config produced by `toAbRouting`. */
export interface AbRoutingConfig<L extends string = string> {
  locales: L[];
  defaultLocale: L;
  localePrefix: AbLocalePrefix;
  localeCookie: { name: string; sameSite: 'lax' } | false;
}

export declare const AB_LOCALE_COOKIE_MAX_AGE: number;
export declare const AB_LOCALE_COOKIE_NAME: 'NEXT_LOCALE';
export declare const AB_LOCALE_PREFIXES: readonly AbLocalePrefix[];
export declare const AB_I18N_DEFAULTS: {
  readonly locales: readonly ['en', 'fr', 'es', 'ru'];
  readonly defaultLocale: 'en';
  readonly localePrefix: 'as-needed';
  readonly localeCookie: AbLocaleCookie;
  readonly messagesDir: 'messages';
};

export declare function isAbLocaleTag(value: unknown): value is string;

export declare function defineAbI18n<const L extends string = 'en' | 'fr' | 'es' | 'ru'>(
  input?: AbI18nConfigInput<L>,
): AbI18nConfig<L>;

export declare function isAbLocale<L extends string>(config: { locales: readonly L[] }, value: unknown): value is L;

export declare function toAbRouting<L extends string>(config: AbI18nConfig<L>): AbRoutingConfig<L>;

export declare function getAbLocaleFromPathname<L extends string>(
  pathname: string,
  config: { locales: readonly L[] },
): L | undefined;

export declare function stripAbLocalePrefix(pathname: string, config: { locales: readonly string[] }): string;

export declare function localizeAbPathname<L extends string>(
  pathname: string,
  locale: L,
  config: AbI18nConfig<L>,
  options?: { forcePrefix?: boolean },
): string;

export declare function getAbLocaleLabel(
  locale: string,
  displayLocale?: string,
  overrides?: Readonly<Partial<Record<string, string>>>,
): string;

export declare function serializeAbLocaleCookie(
  locale: string,
  config: AbI18nConfig,
  options?: { persist?: boolean; path?: string },
): string | null;
