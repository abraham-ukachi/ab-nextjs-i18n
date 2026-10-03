// ===== AB I18N NEXT.JS PLUGIN ===== //
//
// Plain JS so `next.config.*` can import it straight from node_modules.

import createNextIntlPlugin from 'next-intl/plugin';

const PACKAGE_NAME = 'ab-nextjs-i18n';


/**
 * Builds the next-intl plugin config for `withAbI18n` (exported for tests).
 *
 * @param { object } [options]
 * @returns { object } next-intl `PluginConfig`
 */
export function getAbNextIntlPluginConfig(options = {}) {
  const { requestConfig, precompile = false, config } = options;
  const messagesDir = options.messagesDir ?? config?.messagesDir;
  const pluginConfig = {};

  if (requestConfig) pluginConfig.requestConfig = requestConfig;

  // next-intl's experimental precompile (`experimental.messages.precompile`) is
  // opt-in: it aliases `use-intl/format-message` to a format-only runtime, so
  // every message must then come through the catalog loader (`import()` of the JSON).
  if (precompile) {
    const dir = messagesDir ?? 'messages';
    pluginConfig.experimental = {
      messages: {
        format: 'json',
        path: dir.startsWith('.') ? dir : `./${dir}`,
        locales: config?.locales ? [...config.locales] : 'infer',
        ...(config?.sourceLocale ? { sourceLocale: config.sourceLocale } : {}),
        precompile: true,
      },
    };
  }

  return pluginConfig;
}


/**
 * Wraps a Next.js config with next-intl's plugin and adds `ab-nextjs-i18n`
 * to `transpilePackages` (its library entries ship as TypeScript).
 *
 * @param { object } [nextConfig]
 * @param { object } [options]
 * @returns { object } the Next.js config
 */
export function withAbI18n(nextConfig = {}, options = {}) {
  const transpilePackages = [...new Set([...(nextConfig.transpilePackages ?? []), PACKAGE_NAME])];
  const withNextIntl = createNextIntlPlugin(getAbNextIntlPluginConfig(options));
  return withNextIntl({ ...nextConfig, transpilePackages });
}

export default withAbI18n;
