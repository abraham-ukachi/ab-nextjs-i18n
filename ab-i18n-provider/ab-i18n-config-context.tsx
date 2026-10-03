'use client';

// ===== AB I18N CONFIG CONTEXT ===== //

import { createContext, useContext } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { AbI18nConfig } from '../config';

const AbI18nConfigContext = createContext<AbI18nConfig | null>(null);


/** Shares the (serializable) Ab config with client hooks such as `useAbLocaleSwitch`. */
export function AbI18nConfigProvider({ config, children }: { config: AbI18nConfig; children?: ReactNode }): ReactElement {
  return <AbI18nConfigContext.Provider value={config}>{children}</AbI18nConfigContext.Provider>;
}


/** Returns the Ab config passed to `<AbI18nProvider config={...}>` (throws when missing). */
export function useAbI18nConfig<L extends string = string>(): AbI18nConfig<L> {
  const config = useContext(AbI18nConfigContext);
  if (!config) {
    throw new Error('[ab-nextjs-i18n] No config found. Render <AbI18nProvider config={abI18nConfig}> in app/[locale]/layout.tsx.');
  }
  return config as AbI18nConfig<L>;
}
