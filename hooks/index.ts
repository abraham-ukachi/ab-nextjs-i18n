// ===== AB I18N HOOKS ===== //
//
// Thin, typed aliases of next-intl's hooks (they work in Server and Client Components).

import { useFormatter, useLocale, useMessages, useTranslations } from 'next-intl';

/** `useTranslations` (next-intl): `const t = useAbTranslations('App')`. */
export const useAbTranslations = useTranslations;

/** `useLocale` (next-intl): the current locale (typed via `AppConfig['Locale']`). */
export const useAbLocale = useLocale;

/** `useFormatter` (next-intl): dates, numbers, lists and relative times. */
export const useAbFormatter = useFormatter;

/** `useMessages` (next-intl): the messages available in this component tree. */
export const useAbMessages = useMessages;
