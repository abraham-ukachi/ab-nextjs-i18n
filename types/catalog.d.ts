// ===== AB I18N - CATALOG TYPES ===== //

/** One entry of the `supportedApis` catalog. */
export interface AbI18nCatalogEntry {
  /** Exported name, e.g. `useAbLocaleSwitch`. */
  name: string;
  /** Import path, e.g. `ab-nextjs-i18n/server`. */
  entry:
    | 'ab-nextjs-i18n'
    | 'ab-nextjs-i18n/config'
    | 'ab-nextjs-i18n/server'
    | 'ab-nextjs-i18n/navigation'
    | 'ab-nextjs-i18n/proxy'
    | 'ab-nextjs-i18n/plugin';
  /** Source file inside the package. */
  file: string;
  kind: 'component' | 'hook' | 'function' | 'server-action';
  status: 'Done' | 'WIP' | 'TODO';
}
