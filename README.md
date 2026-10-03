<p align="center">
  <!-- Ab - Logo (Light / Dark Mode) -->
  <a href="https://abraham-ukachi.vercel.app" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./.github/ab-logo-dark.svg" />
      <source media="(prefers-color-scheme: light)" srcset="./.github/ab-logo-light.svg" />
      <img src="./.github/ab-logo-light.svg" alt="Ab Logo" width="64" height="64" />
    </picture>
  </a>

  <!-- Next.js - Logo Name (Light / Dark Mode) -->
  <a href="https://nextjs.org" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./.github/nextjs-logoname-dark.svg" />
      <source media="(prefers-color-scheme: light)" srcset="./.github/nextjs-logoname-light.svg" />
      <img src="./.github/nextjs-logoname-light.svg" alt="Next.js LogoName" width="192" height="64" />
    </picture>
  </a>

</p>


<p align="center">
    <a href="https://ab-elements.vercel.app/docs/i18n" target="_blank"><b>Checkout abElements &rarr;</b></a>
</p>


# `ab-nextjs-i18n`

> IMPORTANT: This is a work in progress and subject to major changes until version 1.0.

> Tooling target: **Next.js 16.3.4** / React 19 / **next-intl 4.14.9** / Node.js **>= 22.18**.


🌍 This is a thin, opinionated i18n layer over [next-intl](https://next-intl.dev) with an **Ab CLI** (`init`, `translate`, `check`, `migrate`), created by [Abraham Ukachi](https://github.com/abraham-ukachi), and optimized for [Next.js](https://nextjs.org/docs) App Router applications 😎.

- Locales `en` (default, at `/`), `fr`, `es`, `ru` (at `/fr`, `/es`, `/ru`): `localePrefix: 'as-needed'`.
- `NEXT_LOCALE` cookie: session-only until the user picks a locale, then one year.
- Typed message keys out of the box, ICU messages (`{name}`), JSON files only.
- No UI: headless hooks only (`AbLocaleSwitcher` will live in `ab-nextjs-components`).



## Getting Started

### Installation

#### npm

```bash
npm i ab-nextjs-i18n
```

#### pnpm

```bash
pnpm install ab-nextjs-i18n
```

> NOTE: `next-intl` comes with this package. `next` (>= 16.3.4), `react` and `react-dom` (19) are peer dependencies.
> For the typed keys (and to import `next-intl` yourself), also add it to your app with the same range:
> `pnpm add "next-intl@^4.14.9"` (required with pnpm's strict `node_modules`; `init` reminds you).
> The library entries ship as TypeScript (like every Ab package), so add `ab-nextjs-i18n` to `transpilePackages`
> (`withAbI18n` does it for you).


### Quick start

```bash
npx ab-nextjs-i18n init
```

`init` **only creates missing files** (there is no `--force`) and never edits `next.config`, `package.json` or `tsconfig.json`: it prints the next steps instead.

| No. | File | What it is |
|:----|:-----|:-----------|
| 1 | **i18n/config.ts** | The single source of truth: locales, default, prefix, cookie, messages folder |
| 2 | **i18n/request.ts** | next-intl request config (`createAbRequestConfig`) |
| 3 | **i18n/navigation.ts** | `AbLink`, `redirect`, `usePathname`, `useRouter`, `getPathname` |
| 4 | **i18n/global.d.ts** | Typed keys and locales (next-intl `AppConfig`) |
| 5 | **proxy.ts** | Locale detection, redirects and the cookie (skipped when `proxy.ts` / `middleware.ts` exists) |
| 6 | **messages/{en,fr,es,ru}.json** | Starter messages: `App`, `Common`, `Language`, `Theme`, `NotFound`, `Metadata` |
| 7 | **messages/.ab-i18n-glossary.json** | Terms that are never translated (`abElements`, `Next.js`...) |

> NOTE: With `src/app`, `i18n/` and `proxy.ts` go into `src/` (`--src` / `--no-src` to choose).

Then wire it up:

```js
// next.config.mjs
import { withAbI18n } from 'ab-nextjs-i18n/plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withAbI18n(nextConfig);
// opt in to next-intl's experimental message precompilation (off by default):
// export default withAbI18n(nextConfig, { precompile: true });
```

```tsx
// app/[locale]/layout.tsx
import { notFound } from 'next/navigation';
import { AbI18nProvider } from 'ab-nextjs-i18n';
import { isAbLocale } from 'ab-nextjs-i18n/config';
import { generateAbStaticParams, setAbRequestLocale } from 'ab-nextjs-i18n/server';
import abI18nConfig from '@/i18n/config';

export const generateStaticParams = () => generateAbStaticParams(abI18nConfig);

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isAbLocale(abI18nConfig, locale)) notFound();
  setAbRequestLocale(locale); // static rendering

  return (
    <html lang={locale}>
      <body>
        <AbI18nProvider config={abI18nConfig}>{children}</AbI18nProvider>
      </body>
    </html>
  );
}
```

---


## CLI

A list of all the **CLI commands** (`npx ab-nextjs-i18n <command> --help` for every option):

| No. | Name | File | Status |
|:----|:-----|:-----|:-------|
| 1 | *`init`* | **cli/init.mjs** | [Done](./cli/init.mjs) |
| 2 | *`translate`* | **cli/translate.mjs** | [Done](./cli/translate.mjs) |
| 3 | *`check`* | **cli/check.mjs** | [Done](./cli/check.mjs) |
| 4 | *`migrate`* | **cli/migrate.mjs** | [Done](./cli/migrate.mjs) |

```bash
npx ab-nextjs-i18n init --locales en,fr,es,ru --default en --prefix as-needed --dry-run
npx ab-nextjs-i18n translate --to fr,es --dry-run
npx ab-nextjs-i18n check --strict --format json
npx ab-nextjs-i18n migrate --dir messages --write
```

| No. | Command | Flags |
|:----|:--------|:------|
| 1 | `init` | `--locales` `--default` `--dir` `--prefix` `--src`/`--no-src` `--cwd` `--dry-run` `--json` `--yes` |
| 2 | `translate` | `--from` `--to` `--provider` `--keys` `--force` `--prune` `--concurrency` `--dry-run` `--report md\|json` `--dir` `--cwd` |
| 3 | `check` | `--dir` `--locales` `--source` `--strict` `--format text\|json` `--cwd` |
| 4 | `migrate` | `--dir` `--write` `--names` `--ignore` `--json` `--cwd` |

> NOTE: The CLI reads your `i18n/config.ts` with Node's built-in type stripping (Node >= 22.18), so keep that file free of enums and namespaces. Flags always win.


## Server API

A list of all the supported **server** helpers and their current status:

| No. | Name | File | Status |
|:----|:-----|:-----|:-------|
| 1 | *`createAbRequestConfig`* | **server/ab-request-config.ts** | [Done](./server/ab-request-config.ts) |
| 2 | *`getAbTranslations`* | **server/index.ts** | [Done](./server/index.ts) |
| 3 | *`getAbLocale`* | **server/index.ts** | [Done](./server/index.ts) |
| 4 | *`getAbMessages`* | **server/index.ts** | [Done](./server/index.ts) |
| 5 | *`getAbFormatter`* | **server/index.ts** | [Done](./server/index.ts) |
| 6 | *`setAbRequestLocale`* | **server/index.ts** | [Done](./server/index.ts) |
| 7 | *`generateAbStaticParams`* | **server/index.ts** | [Done](./server/index.ts) |
| 8 | *`getAbAlternates`* | **server/ab-alternates.ts** | [Done](./server/ab-alternates.ts) |
| 9 | *`getAbSitemapEntries`* | **server/ab-sitemap.ts** | [Done](./server/ab-sitemap.ts) |
| 10 | *`setAbLocaleCookie`* | **server/ab-locale-cookie.ts** | [Done](./server/ab-locale-cookie.ts) |
| 11 | *`createAbI18nProxy`* | **proxy/index.ts** | [Done](./proxy/index.ts) |
| 12 | *`withAbI18n`* | **plugin.js** | [Done](./plugin.js) |
| 13 | *`defineAbI18n`* | **config.js** | [Done](./config.js) |


## Client API

A list of all the supported **client** components and hooks and their current status:

| No. | Name | File | Status |
|:----|:-----|:-----|:-------|
| 1 | *`AbI18nProvider`* | **ab-i18n-provider/index.tsx** | [Done](./ab-i18n-provider/index.tsx) |
| 2 | *`useAbLocaleSwitch`* | **use-ab-locale-switch/index.ts** | [Done](./use-ab-locale-switch/index.ts) |
| 3 | *`useAbLocale`* | **hooks/index.ts** | [Done](./hooks/index.ts) |
| 4 | *`useAbTranslations`* | **hooks/index.ts** | [Done](./hooks/index.ts) |
| 5 | *`useAbFormatter`* | **hooks/index.ts** | [Done](./hooks/index.ts) |
| 6 | *`useAbMessages`* | **hooks/index.ts** | [Done](./hooks/index.ts) |
| 7 | *`useAbI18nConfig`* | **ab-i18n-provider/ab-i18n-config-context.tsx** | [Done](./ab-i18n-provider/ab-i18n-config-context.tsx) |
| 8 | *`getAbLocaleLabel`* | **config.js** | [Done](./config.js) |
| 9 | *`createAbNavigation`* | **navigation/index.ts** | [Done](./navigation/index.ts) |

A headless locale switcher (bring your own UI):

```tsx
'use client';
import { useAbLocaleSwitch } from 'ab-nextjs-i18n';

export function LocaleSelect() {
  const { locale, locales, labels, switchLocale, isPending } = useAbLocaleSwitch();

  return (
    <select value={locale} disabled={isPending} onChange={(event) => switchLocale(event.target.value)}>
      {locales.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
    </select>
  );
}
```

> NOTE: `switchLocale(next)` keeps the path, query and hash, and stores the explicit pick in a one-year `NEXT_LOCALE` cookie (`{ persist: false }` keeps it session-only). From a server action, use `setAbLocaleCookie(locale)`.


## Imports

| No. | Entry | What's inside |
|:----|:------|:--------------|
| 1 | `ab-nextjs-i18n` | `AbI18nProvider`, client hooks, `getAbLocaleLabel`, `supportedApis` |
| 2 | `ab-nextjs-i18n/server` | Request config, server getters, alternates, sitemap, `setAbLocaleCookie` |
| 3 | `ab-nextjs-i18n/proxy` | `createAbI18nProxy`, `AB_I18N_MATCHER` |
| 4 | `ab-nextjs-i18n/navigation` | `createAbNavigation` |
| 5 | `ab-nextjs-i18n/config` | `defineAbI18n`, `isAbLocale` and the other pure helpers (plain JS, also used by the CLI) |
| 6 | `ab-nextjs-i18n/plugin` | `withAbI18n` for `next.config` (plain JS) |


## Proxy (with auth)

Next.js 16 calls `middleware.ts` **`proxy.ts`**. Run your guard first, then the i18n proxy:

```ts
// proxy.ts
import { NextResponse } from 'next/server';
import { createAbI18nProxy } from 'ab-nextjs-i18n/proxy';
import { stripAbLocalePrefix, localizeAbPathname } from 'ab-nextjs-i18n/config';
import abI18nConfig from './i18n/config';

export default createAbI18nProxy(abI18nConfig, {
  onRequest(request) {
    const path = stripAbLocalePrefix(request.nextUrl.pathname, abI18nConfig);
    if (path.startsWith('/account') && !request.cookies.has('session')) {
      return NextResponse.redirect(new URL(localizeAbPathname('/login', abI18nConfig.defaultLocale, abI18nConfig), request.url));
    }
  },
});

export const config = { matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)' };
```

> NOTE: Only check cookies or headers here (no database calls). If your app already has a proxy, `init` leaves it alone and prints this merge snippet.


## Static rendering + metadata

```tsx
// app/[locale]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAbLocale } from 'ab-nextjs-i18n/config';
import { getAbAlternates, getAbTranslations } from 'ab-nextjs-i18n/server';
import abI18nConfig from '@/i18n/config';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isAbLocale(abI18nConfig, locale)) notFound(); // narrows `string` to your typed locales
  const t = await getAbTranslations({ locale, namespace: 'Metadata' });

  return {
    title: t('title'),
    // canonical + hreflang (incl. x-default)
    alternates: getAbAlternates(abI18nConfig, '/', { locale, baseUrl: 'https://example.com' }),
  };
}
```

```ts
// app/sitemap.ts
import { getAbSitemapEntries } from 'ab-nextjs-i18n/server';
import abI18nConfig from '@/i18n/config';

export default function sitemap() {
  return getAbSitemapEntries(abI18nConfig, ['/', '/about'], 'https://example.com');
}
```

> NOTE: Next.js 16.3 can read the locale from `next/root-params`, so pages render statically without `setAbRequestLocale`. It only works when the root layout is `app/[locale]/layout.tsx`, so it's **opt-in**: uncomment the `rootParam` lines in `i18n/request.ts`:
>
> ```ts
> import * as rootParams from 'next/root-params';
> // ...
>   rootParam: () => rootParams.locale(),
> ```


## Typed messages

`init` writes `i18n/global.d.ts`, which types next-intl's `AppConfig` from your source messages and locales:

```ts
const t = useAbTranslations('Common');
t('save');    // ✅
t('saev');    // ❌ type error
```


## Message conventions

- ICU MessageFormat only: `"Hello, {name}!"`, `"{count, plural, one {# item} other {# items}}"`, rich text with `<link>…</link>`.
- **No LYD-style `(x)` placeholders**: run `npx ab-nextjs-i18n migrate` (dry run first, then `--write`).
- One JSON file per locale, namespaced by PascalCase keys (`App`, `Common`...). JSON only in v1.

`migrate` only rewrites `(name)` when all of these hold:

1. `name` is a single identifier starting with a lowercase letter: `(x)`, `(m)`, `(count)`.
2. It isn't glued to a word: `item(s)`, `ami(e)s` and `(s)he` stay as they are.
3. Single letters are placeholders, except enumerations: a string with `(a)` + `(b)` or `(i)` + `(ii)` is left alone.
4. Multi-letter names (`(optional)`, `(beta)`) are only rewritten when they're unchanged in the same key of every other locale (real words get translated, placeholders don't), or when listed in `--names`. Otherwise they're reported as ambiguous.
5. `--ignore` names are never rewritten, and a rewrite that would produce invalid ICU is skipped.


## Translation providers

`translate` fills **missing** keys and keys whose **source changed**, tracked in `messages/.ab-i18n-lock.json` (hashes only). Targets you edited by hand are never overwritten: they're reported as *stale* when their source changes.

Placeholders, plural `#` and tags are masked before sending, each plural/select branch is translated separately, and any output whose placeholders or tags don't match is **rejected** (then retried with the next provider). Requests are batched with backoff on `429`; files are written atomically in source key order, and extra keys are kept unless `--prune`.

| No. | Provider | Env vars | Status |
|:----|:---------|:---------|:-------|
| 1 | *`deepl`* (default) | `DEEPL_API_KEY` (`:fx` keys use the free API) | [Done](./cli/providers/deepl.mjs) |
| 2 | *`openai`* (fallback) | `OPENAI_API_KEY`, `AB_I18N_OPENAI_MODEL` | [Done](./cli/providers/openai.mjs) |
| 3 | *`google`* | `GOOGLE_TRANSLATE_API_KEY` | [Done](./cli/providers/google.mjs) |
| 4 | *`libretranslate`* | `LIBRETRANSLATE_URL`, `LIBRETRANSLATE_API_KEY` | [Done](./cli/providers/libretranslate.mjs) |
| 5 | *`trans`* | the `trans` binary ([translate-shell](https://github.com/soimort/translate-shell)) | [Done](./cli/providers/trans.mjs) |

> IMPORTANT: Keys are read from env vars only and never written anywhere. `.env*` is gitignored.

> NOTE: Only `deepl` and `openai` are in the default chain. `google`, `libretranslate` and `trans` are implemented but haven't been tested against the live services yet. DeepL doesn't use the glossary `terms` (only `doNotTranslate`).

The glossary (`messages/.ab-i18n-glossary.json`):

```json
{
  "doNotTranslate": ["abElements", "Next.js"],
  "allowIdentical": ["OK"],
  "terms": { "fr": { "cart": "panier" } }
}
```

Bring your own provider with `--provider ./my-provider.mjs` (comma lists are fallback chains, e.g. `--provider deepl,./my-provider.mjs`):

```js
// my-provider.mjs
export default {
  name: 'my-provider',
  batchSize: 25,
  async translate({ texts, from, to, glossary, env, fetch }) {
    // keep every <ph id="N"/> and tag; same length and order as `texts`
    return texts.map((text) => text);
  },
};
```


## CI

```yaml
- run: npx ab-nextjs-i18n check --strict
```

| No. | Level | Checks |
|:----|:------|:-------|
| 1 | Error (exit 1) | missing keys, empty values, placeholder/tag mismatches, ICU syntax (icu-minify), type mismatches, invalid keys, missing or invalid files |
| 2 | Warning (exit 1 with `--strict`) | extra keys, identical to source (glossary allowlist), empty source, extra locale files |


## Migrating from next-intl / LYD

1. Run `npx ab-nextjs-i18n init --dry-run` to see what would be created; existing files are never touched.
2. Move your locales into `i18n/config.ts`, and swap `next-intl/plugin` for `withAbI18n`.
3. If you have a `middleware.ts`, rename it to `proxy.ts` (`npx @next/codemod@canary middleware-to-proxy .`) and use `createAbI18nProxy`.
4. LYD messages: `npx ab-nextjs-i18n migrate` then `--write` to turn `(x)` into `{x}`, then `check`.
5. Use short locale codes (`en`, `fr`, `es`, `ru`).


## Publishing

Releases are published to npm by GitHub Actions ([publish.yml](./.github/workflows/publish.yml)) with Trusted Publishing (OIDC + provenance, no `NPM_TOKEN`).

> IMPORTANT: **v0.1.0 is published manually by the maintainer first** (with 2FA), so the npm trusted publisher can be linked to this repo. Every later version bump merged to `main` is published by the workflow.


## TODOs

- [ ] Expand plural categories for targets that need more than the source (e.g. `few` / `many` in `ru`)
- [ ] `check --usage` (unused / unknown keys in the source code)
- [ ] DeepL glossaries for `terms`
- [ ] YAML messages
- [ ] RTL and domain routing
- [ ] `AbLocaleSwitcher` in **`ab-nextjs-components`**
- [ ] Test `google`, `libretranslate` and `trans` against the live services


## Learn More abElements

To learn more about **`abElements`**, take a look at the following resources:

- [abElements Documentation](https://ab-elements.vercel.app/docs) - learn about `abElements` features and API.
- [abElements i18n](https://ab-elements.vercel.app/docs/i18n) - learn about **i18n** in `abElements`.
- [abElements Core](https://ab-elements.vercel.app/docs/core) - learn about **core** in `abElements`.
- [abElements Theme](https://ab-elements.vercel.app/docs/theme) - learn about **theme** in `abElements`.
- [abElements Components](https://ab-elements.vercel.app/docs/components) - learn about **components** in `abElements`.
- [abElements Hooks](https://ab-elements.vercel.app/docs/hooks) - learn about **hooks** in `abElements`.

You can check out [the abElements GitHub repository](https://github.com/abraham-ukachi/ab-elements-app) for more details.


## License

This **`ab-nextjs-i18n`** project is [MIT Licensed](./LICENSE) ;)
