// ===== AB REQUEST CONFIG ===== //

import type { Locale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import type { GetRequestConfigParams, RequestConfig } from 'next-intl/server';
import { isAbLocale } from '../config';
import type { AbI18nConfig } from '../config';

/** The messages of one locale (nested JSON). */
export type AbMessages = Record<string, unknown>;

export interface AbRequestConfigOptions<L extends string = string> {
  /** Your `defineAbI18n` config. */
  config: AbI18nConfig<L>;
  /**
   * Loads the messages of a locale, e.g.
   * `(locale) => import(\`../messages/${locale}.json\`).then((m) => m.default)`.
   * Keep the `import()` in your app so next-intl's (opt-in) precompile loader sees it.
   */
  loadMessages: (locale: L) => Promise<AbMessages> | AbMessages;
  /**
   * Optional root-param reader, e.g. `() => rootParams.locale()` from
   * `import * as rootParams from 'next/root-params'` (Next 16.3+). Only works
   * when the root layout lives in `app/[locale]/layout.tsx`. When it's missing,
   * returns nothing or throws (Server Actions, Route Handlers), the request
   * locale from the proxy (`requestLocale`) is used instead.
   */
  rootParam?: () => Promise<string | undefined> | string | undefined;
  /** Extra next-intl request config (timeZone, now, formats, onError, getMessageFallback...). */
  extend?: (locale: L) => Partial<Omit<RequestConfig, 'locale' | 'messages'>> | Promise<Partial<Omit<RequestConfig, 'locale' | 'messages'>>>;
}


/**
 * Resolves the locale of a request: explicit override → root param → proxy
 * (`requestLocale`) → `defaultLocale`. Exported for tests.
 */
export async function resolveAbRequestLocale<L extends string>(
  config: AbI18nConfig<L>,
  params: Partial<GetRequestConfigParams>,
  rootParam?: AbRequestConfigOptions<L>['rootParam'],
): Promise<L> {
  if (isAbLocale(config, params.locale)) return params.locale;

  if (rootParam) {
    try {
      const value = await rootParam();
      if (isAbLocale(config, value)) return value;
    } catch {
      // `next/root-params` isn't available here (e.g. a Server Action): fall through.
    }
  }

  if (params.requestLocale) {
    const value = await params.requestLocale;
    if (isAbLocale(config, value)) return value;
  }

  return config.defaultLocale;
}


/**
 * Creates the default export of `i18n/request.ts`.
 */
export function createAbRequestConfig<L extends string>(
  options: AbRequestConfigOptions<L>,
): ReturnType<typeof getRequestConfig> {
  const { config, loadMessages, rootParam, extend } = options;

  return getRequestConfig(async (params) => {
    const locale = await resolveAbRequestLocale(config, params, rootParam);
    const [messages, extra] = await Promise.all([loadMessages(locale), extend ? extend(locale) : undefined]);
    // `Locale` is the app's narrowed `AppConfig['Locale']` (i18n/global.d.ts) or `string`.
    return { ...extra, locale: locale as Locale, messages: messages as RequestConfig['messages'] };
  });
}
