// ===== AB I18N PROVIDER ===== //
//
// A Server Component (render it in `app/[locale]/layout.tsx`): it wraps
// next-intl's `NextIntlClientProvider` and shares the Ab config with the client.

import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ComponentProps, ReactElement } from 'react';
import type { AbI18nConfig } from '../config';
import { AbI18nConfigProvider } from './ab-i18n-config-context';

type NextIntlClientProviderProps = ComponentProps<typeof NextIntlClientProvider>;

export type AbI18nProviderProps = NextIntlClientProviderProps & {
  /** Your `defineAbI18n` config (needed by `useAbLocaleSwitch`). */
  config: AbI18nConfig;
  /** Only send these top-level namespaces to the client (e.g. `['App']`). */
  namespaces?: readonly string[];
};


/** Picks the given top-level namespaces from `messages`. Exported for tests. */
export function pickAbNamespaces(messages: Record<string, unknown>, namespaces: readonly string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const namespace of namespaces) {
    if (namespace in messages) picked[namespace] = messages[namespace];
  }
  return picked;
}


/** Provides translations + the Ab config to Client Components. */
export default async function AbI18nProvider({
  config,
  namespaces,
  messages,
  children,
  ...rest
}: AbI18nProviderProps): Promise<ReactElement> {
  let clientMessages = messages;
  if (namespaces) {
    const all = (messages ?? (await getMessages(rest.locale ? { locale: rest.locale } : undefined))) as Record<string, unknown>;
    clientMessages = pickAbNamespaces(all, namespaces) as NextIntlClientProviderProps['messages'];
  }

  return (
    <NextIntlClientProvider {...rest} {...(clientMessages !== undefined ? { messages: clientMessages } : {})}>
      <AbI18nConfigProvider config={config}>{children}</AbI18nConfigProvider>
    </NextIntlClientProvider>
  );
}

export { AbI18nProvider };
