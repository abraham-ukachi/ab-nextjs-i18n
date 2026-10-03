'use client';

// ===== USE AB LOCALE SWITCH ===== //
//
// Headless locale switcher: the visual `AbLocaleSwitcher` lives in ab-nextjs-components.

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';
import { getAbLocaleLabel, localizeAbPathname, serializeAbLocaleCookie } from '../config';
import { useAbI18nConfig } from '../ab-i18n-provider/ab-i18n-config-context';

export interface AbSwitchLocaleOptions {
  /**
   * Keep the pick for one year (`localeCookie.maxAge`). Defaults to `true`: calling
   * `switchLocale` is the user's explicit pick. `false` keeps a session cookie.
   */
  persist?: boolean;
  /** Scroll to the top after switching. Defaults to `false`. */
  scroll?: boolean;
}

export interface AbLocaleSwitch<L extends string = string> {
  /** The current locale. */
  locale: L;
  /** Every locale of the config. */
  locales: readonly L[];
  /** Native labels (`{ en: 'English', fr: 'Français', ... }`), with `localeLabels` overrides. */
  labels: Record<L, string>;
  /** Switches to `next`, keeping the current path, query and hash. */
  switchLocale: (next: L, options?: AbSwitchLocaleOptions) => void;
  /** `true` while the new locale is rendering. */
  isPending: boolean;
}


/** Headless locale switcher for menus, selects and globe buttons. */
export function useAbLocaleSwitch<L extends string = string>(): AbLocaleSwitch<L> {
  const config = useAbI18nConfig<L>();
  const locale = useLocale() as L;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const labels = useMemo(() => {
    const result = {} as Record<L, string>;
    for (const item of config.locales) result[item] = getAbLocaleLabel(item, item, config.localeLabels);
    return result;
  }, [config]);

  const switchLocale = useCallback(
    (next: L, options: AbSwitchLocaleOptions = {}) => {
      if (!config.locales.includes(next)) {
        throw new Error(`[ab-nextjs-i18n] Unsupported locale "${next}" (locales: ${config.locales.join(', ')}).`);
      }

      const cookie = serializeAbLocaleCookie(next, config, {
        persist: options.persist ?? true,
        secure: window.location.protocol === 'https:',
      });
      if (cookie) document.cookie = cookie;

      // Without a cookie, an unprefixed URL could be re-detected (Accept-Language), so force the prefix.
      const target = localizeAbPathname(pathname || '/', next, config, { forcePrefix: !cookie });
      const href = `${target}${window.location.search}${window.location.hash}`;

      startTransition(() => {
        router.replace(href, { scroll: options.scroll ?? false });
      });
    },
    [config, pathname, router],
  );

  return { locale, locales: config.locales, labels, switchLocale, isPending };
}

export default useAbLocaleSwitch;
