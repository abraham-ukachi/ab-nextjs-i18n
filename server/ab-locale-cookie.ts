// ===== AB LOCALE COOKIE ACTION ===== //

import { cookies } from 'next/headers';
import { isAbLocale } from '../config';
import type { AbI18nConfig } from '../config';

/** The action `createAbLocaleCookieAction` returns: saves an explicit locale pick. */
export type AbLocaleCookieAction = (locale: string) => Promise<void>;


/**
 * Creates the function that saves the user's explicit locale pick in the locale cookie,
 * bound to your config: the locale must be one of `config.locales`, and the cookie uses
 * `config.localeCookie` (`name`, `maxAge`: one year by default), `path: '/'`,
 * `sameSite: 'lax'` and `secure` in production. Callers can't change any of that.
 *
 * Call it from your own `'use server'` file (a Server Action) or a Route Handler.
 */
export function createAbLocaleCookieAction<L extends string>(config: AbI18nConfig<L>): AbLocaleCookieAction {
  const { localeCookie } = config;
  if (!localeCookie) throw new Error('[ab-nextjs-i18n] `localeCookie` is disabled in your config.');
  const { name, maxAge } = localeCookie;

  return async function setAbLocaleCookie(locale: string): Promise<void> {
    if (!isAbLocale(config, locale)) {
      throw new Error(`[ab-nextjs-i18n] Unsupported locale "${String(locale)}" (locales: ${config.locales.join(', ')}).`);
    }
    const store = await cookies();
    store.set(name, locale, { path: '/', sameSite: 'lax', maxAge, secure: process.env.NODE_ENV === 'production' });
  };
}
