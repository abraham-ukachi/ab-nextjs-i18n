# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 0.1.0 (2026-10-03)

* First release: a thin i18n layer over next-intl `^4.14.9` for Next.js 16.3 (`localePrefix: 'as-needed'`, locales `en`, `fr`, `es`, `ru`)
* `next-intl` (`^4.14.9`) is a **peer dependency**, installed by the app next to this package (`pnpm add ab-nextjs-i18n next-intl`); `icu-minify` (used by the CLI) and `server-only` are direct dependencies
* `defineAbI18n`, `withAbI18n` (precompile opt-in), `createAbRequestConfig`, `createAbI18nProxy`, `createAbNavigation`, `AbI18nProvider`
* Request locale from `next/root-params` by default (`app/[locale]/layout.tsx` as the root layout, static rendering without `setRequestLocale`); next-intl's deprecated `requestLocale` is only the fallback (Server Actions, Route Handlers)
* `ab-nextjs-i18n/server` is server-only (`import 'server-only'`): importing it from a Client Component is a build error
* Headless hooks: `useAbLocaleSwitch`, `useAbLocale`, `useAbTranslations`, `useAbFormatter`, plus `getAbLocaleLabel`
* `NEXT_LOCALE` cookie: only written on an explicit pick, by `switchLocale` or by a Server Action made with `createAbLocaleCookieAction(config)` (bound to `config.locales` and `config.localeCookie`: one year by default, `sameSite: 'lax'`, `path: '/'`, `secure` in production). The proxy never writes it: it strips the session cookie next-intl sets on plain visits (`/fr`), so a saved pick is never overwritten
* SEO helpers: `getAbAlternates` (hreflang + x-default) and `getAbSitemapEntries`
* CLI `init`: never overwrites, typed keys via `global.d.ts`, 4 starter messages per locale (a plain string, an ICU `{name}` placeholder, a plural with each locale's CLDR categories and a rich-text tag), detects an existing `proxy` / `middleware` (`.ts`, `.js`, `.mts`, `.mjs`), prints the install command for anything missing
* CLI `translate`: DeepL, then OpenAI (`gpt-6-luna`, `reasoning_effort: 'low'`) as the fallback, lock file, placeholder masking. Providers and keys are only needed when there is something to translate; each provider only receives its own declared `envKeys`; key values (and `sk-…` / `…:fx` keys) are redacted from errors and reports; `trans` gets `--` before the text
* CLI `check` (CI): missing / extra keys, placeholder and tag mismatches, ICU syntax, and plural categories missing for a locale (CLDR, `Intl.PluralRules`); `migrate` (`(x)` to ICU `{x}`)
* README with copy-pasteable usage examples (config, proxy with auth, layout, server/client translations, ICU, formatting, switcher, navigation and its cookies, metadata, sitemap, CLI, CI)
* Publish workflow copied from `ab-nextjs-animations` (Trusted Publishing), with a typecheck step. **v0.1.0 is published manually by the maintainer first** so the npm trusted publisher can be linked
