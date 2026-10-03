// ===== AB I18N NEXT.JS PLUGIN - TYPES ===== //

import type { NextConfig } from 'next';
import type { AbI18nConfig } from './config';

export interface AbI18nPluginOptions {
  /** Path to the request config. Defaults to next-intl's lookup: `./(src/)i18n/request.{ts,tsx,js,jsx}`. */
  requestConfig?: string;
  /** Opt in to next-intl's experimental ICU precompilation (`experimental.messages.precompile`). Off by default. */
  precompile?: boolean;
  /** Messages folder used by `precompile`. Defaults to `config.messagesDir` or `messages`. */
  messagesDir?: string;
  /** Your `defineAbI18n` config (used for `messagesDir`, `locales` and `sourceLocale`). */
  config?: AbI18nConfig;
}

/** The next-intl plugin config that `withAbI18n` builds. */
export interface AbNextIntlPluginConfig {
  requestConfig?: string;
  experimental?: {
    messages: {
      format: 'json';
      path: string;
      locales: 'infer' | string[];
      sourceLocale?: string;
      precompile: true;
    };
  };
}

export declare function getAbNextIntlPluginConfig(options?: AbI18nPluginOptions): AbNextIntlPluginConfig;

export declare function withAbI18n(nextConfig?: NextConfig, options?: AbI18nPluginOptions): NextConfig;

export default withAbI18n;
