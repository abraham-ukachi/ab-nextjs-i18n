'use server';

// ===== AB LOCALE COOKIE (Server Action) ===== //

import { cookies } from 'next/headers';

export interface AbLocaleCookieOptions {
  /** Defaults to `NEXT_LOCALE`. */
  name?: string;
  /** Defaults to one year (31536000 s). */
  maxAge?: number;
  /** When given, `locale` must be one of these. */
  locales?: readonly string[];
}

const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const NAME_PATTERN = /^[A-Za-z0-9_-]+$/;


/**
 * Server Action: persists the user's explicit locale pick (1 year by default),
 * e.g. after login from `user_settings.locale_code`.
 */
export async function setAbLocaleCookie(locale: string, options: AbLocaleCookieOptions = {}): Promise<void> {
  const name = options.name ?? 'NEXT_LOCALE';
  const maxAge = options.maxAge ?? 60 * 60 * 24 * 365;

  if (!LOCALE_PATTERN.test(String(locale))) throw new Error(`[ab-nextjs-i18n] Invalid locale "${locale}".`);
  if (options.locales && !options.locales.includes(locale)) throw new Error(`[ab-nextjs-i18n] Unsupported locale "${locale}".`);
  if (!NAME_PATTERN.test(name)) throw new Error(`[ab-nextjs-i18n] Invalid cookie name "${name}".`);
  if (!Number.isInteger(maxAge) || maxAge <= 0) throw new Error('[ab-nextjs-i18n] `maxAge` must be a positive integer.');

  const store = await cookies();
  store.set(name, locale, { path: '/', sameSite: 'lax', maxAge });
}
