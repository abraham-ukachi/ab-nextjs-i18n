// ===== AB I18N NAVIGATION ===== //

import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { toAbRouting } from '../config';
import type { AbI18nConfig, AbLocalePrefix } from '../config';

type NextIntlNavigation<L extends string> = ReturnType<typeof createNavigation<readonly L[], AbLocalePrefix>>;

/** What `createAbNavigation` returns: next-intl's navigation APIs plus the `AbLink` alias. */
export type AbNavigation<L extends string = string> = Pick<
  NextIntlNavigation<L>,
  'Link' | 'redirect' | 'permanentRedirect' | 'usePathname' | 'useRouter' | 'getPathname'
> & {
  AbLink: NextIntlNavigation<L>['Link'];
};


/**
 * Locale-aware navigation APIs (wraps next-intl's `createNavigation`).
 * Call it once in `i18n/navigation.ts` and import from there.
 */
export function createAbNavigation<L extends string>(config: AbI18nConfig<L>): AbNavigation<L> {
  const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } = createNavigation(
    defineRouting(toAbRouting(config)),
  ) as unknown as NextIntlNavigation<L>;

  return { AbLink: Link, Link, redirect, permanentRedirect, usePathname, useRouter, getPathname };
}
