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

> NOTE: Every TypeScript example below was copied from a Next.js 16.3.4 test app and checked with `next build` and `tsc`.



## Getting Started

### Installation

#### npm

```bash
npm i ab-nextjs-i18n next-intl
```

#### pnpm

```bash
pnpm add ab-nextjs-i18n next-intl
```

> IMPORTANT: `next-intl` (`^4.14.9`) is a **peer dependency**: install it in your app next to `ab-nextjs-i18n`.
> Your app, the typed keys in `i18n/global.d.ts` and `ab-nextjs-i18n` then share one next-intl instance.
> If you forget it, `init` reminds you with your package manager's command. With pnpm's default `autoInstallPeers: true`
> the missing peer is installed silently for `ab-nextjs-i18n` only: your app can't import `next-intl` and the typed keys stop working.
> With `autoInstallPeers: false` pnpm warns (`pnpm peers check`), and `strictPeerDependencies: true` fails the install.

> NOTE: `next` (>= 16.3.4), `react` and `react-dom` (19) are peer dependencies too. `icu-minify` (used by the CLI) comes with this package.
> The library entries ship as TypeScript (like every Ab package), so add `ab-nextjs-i18n` to `transpilePackages`
> (`withAbI18n` does it for you).


### Quick start

Create the i18n files (it only creates missing ones, and prints the next steps):

```bash
npx ab-nextjs-i18n init
```

`init` **only creates missing files** (there is no `--force`) and never edits `next.config`, `package.json` or `tsconfig.json`: it prints the next steps instead, starting with the install command for anything missing (e.g. `pnpm add ab-nextjs-i18n next-intl`).

| No. | File | What it is |
|:----|:-----|:-----------|
| 1 | **i18n/config.ts** | The single source of truth: locales, default, prefix, cookie, messages folder |
| 2 | **i18n/request.ts** | next-intl request config (`createAbRequestConfig`) |
| 3 | **i18n/navigation.ts** | `AbLink`, `redirect`, `usePathname`, `useRouter`, `getPathname` |
| 4 | **i18n/global.d.ts** | Typed keys and locales (next-intl `AppConfig`) |
| 5 | **proxy.ts** | Locale detection, redirects and the cookie (skipped when `proxy.ts` / `middleware.ts` exists) |
| 6 | **messages/{en,fr,es,ru}.json** | 4 demo messages to replace or extend (see below) |
| 7 | **messages/.ab-i18n-glossary.json** | Terms that are never translated (`abElements`) |

> NOTE: With `src/app`, `i18n/` and `proxy.ts` go into `src/` (`--src` / `--no-src` to choose).

The starter messages are 4 examples, one of each kind (a plain string, an ICU placeholder, a plural and a rich-text tag), with the same keys in every locale:

`messages/en.json`:

```json
{
  "App": {
    "title": "Welcome to abElements",
    "greeting": "Hello, {name}!",
    "items": "{count, plural, =0 {No items yet} one {# item} other {# items}}",
    "learnMore": "Read the <link>docs</link> to add your own messages."
  }
}
```

`messages/fr.json`:

```json
{
  "App": {
    "title": "Bienvenue sur abElements",
    "greeting": "Bonjour, {name} !",
    "items": "{count, plural, =0 {Aucun élément pour l’instant} one {# élément} other {# éléments}}",
    "learnMore": "Lisez la <link>documentation</link> pour ajouter vos propres messages."
  }
}
```


### Config

The generated config: every helper, the proxy and the CLI read it.

```ts
// i18n/config.ts
// i18n config: the single source of truth for locales (used by the app, the proxy and the ab-nextjs-i18n CLI).
// Keep this file free of TypeScript-only runtime syntax (enums, namespaces): the CLI imports it with Node's type stripping.
import { defineAbI18n } from 'ab-nextjs-i18n/config';

export const abI18nConfig = defineAbI18n({
  locales: ['en', 'fr', 'es', 'ru'],
  defaultLocale: 'en',
  // 'as-needed': the default locale lives at `/`, the others at `/fr`, `/es`...
  localePrefix: 'as-needed',
  // Session cookie until the user picks a locale, then one year.
  localeCookie: { name: 'NEXT_LOCALE', maxAge: 60 * 60 * 24 * 365 },
  messagesDir: 'messages',
});

export type AppLocale = (typeof abI18nConfig.locales)[number];

export default abI18nConfig;
```

Your own locales, an always-prefixed URL, a custom cookie and label overrides:

```ts
// i18n/config.ts
import { defineAbI18n } from 'ab-nextjs-i18n/config';

export const abI18nConfig = defineAbI18n({
  locales: ['en', 'fr', 'de', 'pt-BR'],
  defaultLocale: 'en',
  localePrefix: 'always', // every locale in the URL: /en, /fr, /de, /pt-BR
  localeCookie: { name: 'APP_LOCALE', maxAge: 60 * 60 * 24 * 180 }, // 6 months once picked
  messagesDir: 'locales',
  localeLabels: { 'pt-BR': 'Português (BR)' }, // override the Intl.DisplayNames label
});

export type AppLocale = (typeof abI18nConfig.locales)[number]; // 'en' | 'fr' | 'de' | 'pt-BR'
```

> NOTE: The CLI imports this file with Node's type stripping (Node >= 22.18): keep it free of enums and namespaces.


### next.config

Wrap your config: it plugs in next-intl and adds `ab-nextjs-i18n` to `transpilePackages`.

```ts
// next.config.ts
import type { NextConfig } from 'next';
import { withAbI18n } from 'ab-nextjs-i18n/plugin';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withAbI18n(nextConfig);
```

Opt in to next-intl's experimental ICU precompilation (off by default):

```ts
// next.config.ts
import type { NextConfig } from 'next';
import { withAbI18n } from 'ab-nextjs-i18n/plugin';
import abI18nConfig from './i18n/config';

const nextConfig: NextConfig = {};

// Opt in to next-intl's experimental ICU precompilation (off by default).
// `config` lets it read your locales, source locale and messages folder.
export default withAbI18n(nextConfig, { precompile: true, config: abI18nConfig });
```


### Layout

`app/[locale]/layout.tsx`: validate the locale, enable static rendering, set `<html lang>` and provide the messages to Client Components.

```tsx
// app/[locale]/layout.tsx
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { AbI18nProvider } from 'ab-nextjs-i18n';
import { isAbLocale } from 'ab-nextjs-i18n/config';
import { generateAbStaticParams, setAbRequestLocale } from 'ab-nextjs-i18n/server';
import abI18nConfig from '@/i18n/config';

// Prerender /, /fr, /es and /ru at build time.
export const generateStaticParams = () => generateAbStaticParams(abI18nConfig);

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAbLocale(abI18nConfig, locale)) notFound(); // unknown prefix → 404
  setAbRequestLocale(locale); // enables static rendering

  return (
    <html lang={locale}>
      <body>
        <AbI18nProvider config={abI18nConfig}>{children}</AbI18nProvider>
      </body>
    </html>
  );
}
```

Only send some namespaces to the client (smaller pages):

```tsx
<AbI18nProvider config={abI18nConfig} namespaces={['App']}>{children}</AbI18nProvider>
```

The generated request config (next-intl finds it automatically):

```ts
// i18n/request.ts
// next-intl request config (found automatically by `withAbI18n` / next-intl's plugin).
import { createAbRequestConfig } from 'ab-nextjs-i18n/server';
import abI18nConfig from './config';

export default createAbRequestConfig({
  config: abI18nConfig,
  // Keep this `import()` here so next-intl's (opt-in) precompile loader can see the JSON files.
  loadMessages: async (locale) => (await import(`../messages/${locale}.json`)).default,
  // Next.js 16.3+: once your root layout is `app/[locale]/layout.tsx`, you can read the
  // locale from `next/root-params` (static rendering without `setRequestLocale`):
  //   import * as rootParams from 'next/root-params';
  //   rootParam: () => rootParams.locale(),
});
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

| No. | Command | Flags |
|:----|:--------|:------|
| 1 | `init` | `--locales` `--default` `--dir` `--prefix` `--src`/`--no-src` `--cwd` `--dry-run` `--json` `--yes` |
| 2 | `translate` | `--from` `--to` `--provider` `--keys` `--force` `--prune` `--concurrency` `--dry-run` `--report md\|json` `--dir` `--cwd` |
| 3 | `check` | `--dir` `--locales` `--source` `--strict` `--format text\|json` `--cwd` |
| 4 | `migrate` | `--dir` `--write` `--names` `--ignore` `--json` `--cwd` |

> NOTE: The CLI reads your `i18n/config.ts` (Node >= 22.18). Flags always win.

### `init`

```bash
# defaults: en (default), fr, es, ru · 'as-needed' · messages/
npx ab-nextjs-i18n init

# show what would be created, write nothing
npx ab-nextjs-i18n init --dry-run

# your own locales: the default (de) gets the English starters to translate, unknown others start as {}
npx ab-nextjs-i18n init --locales en,de,it --default de

# every locale in the URL, messages in locales/, files in src/
npx ab-nextjs-i18n init --prefix always --dir locales --src

# another folder, machine-readable report
npx ab-nextjs-i18n init --cwd apps/web --json

# no package.json / next found (custom setup): run anyway
npx ab-nextjs-i18n init --yes
```

### `translate`

```bash
# keys only come from env vars (never commit them)
export DEEPL_API_KEY="…"   # DeepL first (":fx" keys use the free API)
export OPENAI_API_KEY="…"  # OpenAI as the fallback, also for anything DeepL gets wrong

# every other locale: missing keys + keys whose source changed
npx ab-nextjs-i18n translate

# some locales / some keys only
npx ab-nextjs-i18n translate --to fr,es
npx ab-nextjs-i18n translate --keys App.greeting,Cart.*

# the plan only: no API calls, no writes (no keys needed)
npx ab-nextjs-i18n translate --dry-run

# a report for a PR comment, or for scripts
npx ab-nextjs-i18n translate --report md > i18n-report.md
npx ab-nextjs-i18n translate --report json

# one provider, or your own chain / model
npx ab-nextjs-i18n translate --provider openai
AB_I18N_OPENAI_MODEL="gpt-6-luna" npx ab-nextjs-i18n translate --provider deepl,openai

# re-translate machine-owned keys (never your hand edits), drop keys that left the source
npx ab-nextjs-i18n translate --force
npx ab-nextjs-i18n translate --prune
```

### `check`

```bash
npx ab-nextjs-i18n check                                   # exit 1 on errors
npx ab-nextjs-i18n check --strict                          # also exit 1 on warnings
npx ab-nextjs-i18n check --format json > i18n-check.json   # for tools
npx ab-nextjs-i18n check --locales fr --source en          # one locale against the source
```

What a failing check looks like (a missing key and a translated placeholder in `fr`):

```text
ab-nextjs-i18n check messages · source en · en, fr

Severity  Locale  Key           Code                  Message
────────  ──────  ────────────  ────────────────────  ─────────────────────────────
error     fr      App.title     missing-key           missing translation
error     fr      App.greeting  placeholder-mismatch  missing placeholder(s) {name}
error     fr      App.greeting  placeholder-mismatch  unknown placeholder(s) {nom}

✖ 3 error(s), 0 warning(s)
```

### `migrate`

Turn LYD-style `(x)` placeholders into ICU `{x}` (a dry run first, then `--write`):

```bash
npx ab-nextjs-i18n migrate                 # dry run: shows a before/after table
npx ab-nextjs-i18n migrate --write         # atomic writes
npx ab-nextjs-i18n migrate --names count   # treat (count) as a placeholder too
npx ab-nextjs-i18n migrate --ignore beta   # never touch (beta)
```

Before (`messages/en.json`, with the same keys in `fr.json`):

```json
{
  "Cart": {
    "summary": "You have (x) items in (y) carts",
    "hint": "Fields marked (optional) can stay empty",
    "price": "Total (m) €"
  }
}
```

After `migrate --write` (`(optional)` is translated in `fr.json`, so it's a word and stays):

```json
{
  "Cart": {
    "summary": "You have {x} items in {y} carts",
    "hint": "Fields marked (optional) can stay empty",
    "price": "Total {m} €"
  }
}
```

Then update the code: `t('summary').replace('(x)', a)` becomes `t('summary', { x: a, y: b })`.


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

### Server Components

`getAbTranslations('App')` uses the request's locale; `getAbFormatter()` formats numbers and dates for it:

```tsx
// app/[locale]/page.tsx
import { notFound } from 'next/navigation';
import { isAbLocale } from 'ab-nextjs-i18n/config';
import { getAbFormatter, getAbTranslations, setAbRequestLocale } from 'ab-nextjs-i18n/server';
import abI18nConfig from '@/i18n/config';
import { AbLink } from '@/i18n/navigation';
import { CartBadge } from '@/components/cart-badge';
import { LocaleButtons } from '@/components/locale-buttons';
import { LocaleSelect } from '@/components/locale-select';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAbLocale(abI18nConfig, locale)) notFound();
  setAbRequestLocale(locale);

  const t = await getAbTranslations('App'); // the request's locale
  const format = await getAbFormatter();

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('greeting', { name: 'Ada' })}</p>
      <p>{t('items', { count: 3 })}</p>
      <p>{t.rich('learnMore', { link: (chunks) => <AbLink href="/docs">{chunks}</AbLink> })}</p>
      <p>{format.number(1234.5, { style: 'currency', currency: 'EUR' })}</p>
      <p>{format.dateTime(new Date('2026-10-03T12:00:00Z'), { dateStyle: 'long', timeZone: 'Europe/Paris' })}</p>
      <CartBadge count={2} />
      <LocaleSelect />
      <LocaleButtons />
    </main>
  );
}
```

With an explicit locale (e.g. in `generateMetadata`, see [Static rendering + metadata](#static-rendering--metadata)):

```ts
const t = await getAbTranslations({ locale, namespace: 'App' });
```

### Saving the user's choice (Server Action)

`setAbLocaleCookie` stores the explicit pick for one year, then `redirect` (from `i18n/navigation`) sends the user to the new locale:

```ts
// app/[locale]/settings/actions.ts
'use server';

import { setAbLocaleCookie } from 'ab-nextjs-i18n/server';
import abI18nConfig from '@/i18n/config';
import { redirect } from '@/i18n/navigation';

export async function saveLanguage(formData: FormData) {
  const locale = String(formData.get('locale'));
  // await db.userSettings.update({ localeCode: locale }); // persist it for the user too
  await setAbLocaleCookie(locale, { locales: abI18nConfig.locales }); // 1-year NEXT_LOCALE cookie
  redirect({ href: '/settings', locale: locale as (typeof abI18nConfig.locales)[number] });
}
```

```tsx
// app/[locale]/settings/page.tsx
import { getAbLocaleLabel } from 'ab-nextjs-i18n';
import abI18nConfig from '@/i18n/config';
import { saveLanguage } from './actions';

export default function SettingsPage() {
  return (
    <form action={saveLanguage}>
      <select name="locale" defaultValue={abI18nConfig.defaultLocale}>
        {abI18nConfig.locales.map((locale) => (
          <option key={locale} value={locale}>
            {getAbLocaleLabel(locale)}
          </option>
        ))}
      </select>
      <button type="submit">Save</button>
    </form>
  );
}
```


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

### Client Components

`useAbTranslations` and `useAbFormatter` in a Client Component (inside `AbI18nProvider`):

```tsx
// components/cart-badge.tsx
'use client';

import { useAbFormatter, useAbTranslations } from 'ab-nextjs-i18n';

export function CartBadge({ count }: { count: number }) {
  const t = useAbTranslations('App');
  const format = useAbFormatter();

  return (
    <p>
      {t('items', { count })} · {format.number(count * 9.99, { style: 'currency', currency: 'EUR' })}
    </p>
  );
}
```

### Locale switcher (headless)

A `<select>`: `switchLocale` keeps the path, query and hash, and stores the pick for one year:

```tsx
// components/locale-select.tsx
'use client';

import { useAbLocaleSwitch } from 'ab-nextjs-i18n';
import type { AppLocale } from '@/i18n/config';

export function LocaleSelect() {
  const { locale, locales, labels, switchLocale, isPending } = useAbLocaleSwitch<AppLocale>();

  return (
    <select value={locale} disabled={isPending} onChange={(event) => switchLocale(event.target.value as AppLocale)}>
      {locales.map((item) => (
        <option key={item} value={item}>
          {labels[item]}
        </option>
      ))}
    </select>
  );
}
```

Buttons, plus a "preview" that only lasts for the session (`persist: false`):

```tsx
// components/locale-buttons.tsx
'use client';

import { useAbLocaleSwitch } from 'ab-nextjs-i18n';
import type { AppLocale } from '@/i18n/config';

export function LocaleButtons() {
  const { locale, locales, labels, switchLocale } = useAbLocaleSwitch<AppLocale>();

  return (
    <nav aria-label="Language">
      {locales.map((item) => (
        <button key={item} aria-pressed={item === locale} onClick={() => switchLocale(item)}>
          {labels[item]}
        </button>
      ))}
      {/* try a locale for this visit only: session cookie, no 1-year pick */}
      <button onClick={() => switchLocale('fr', { persist: false })}>Aperçu en français</button>
    </nav>
  );
}
```

> NOTE: `switchLocale(next)` defaults to `{ persist: true }` (a `NEXT_LOCALE` cookie for `localeCookie.maxAge`, one year by default); `{ persist: false }` writes a session cookie. Pass `{ scroll: true }` to scroll to the top.

### Locale labels

`getAbLocaleLabel` names a locale with `Intl.DisplayNames` (native by default):

```ts
import { getAbLocaleLabel } from 'ab-nextjs-i18n';

getAbLocaleLabel('fr'); // 'Français'
getAbLocaleLabel('ru'); // 'Русский'
getAbLocaleLabel('pt-BR'); // 'Português (Brasil)'
getAbLocaleLabel('fr', 'en'); // 'French' (in English)
getAbLocaleLabel('en', undefined, { en: 'English (US)' }); // 'English (US)' (e.g. config.localeLabels)
```

### Navigation

The generated `i18n/navigation.ts`: use these instead of `next/link` and `next/navigation`.

```ts
// i18n/navigation.ts
// Locale-aware navigation: use these instead of `next/link` and `next/navigation`.
import { createAbNavigation } from 'ab-nextjs-i18n/navigation';
import abI18nConfig from './config';

export const { AbLink, Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } =
  createAbNavigation(abI18nConfig);
```

`AbLink`, `usePathname` and `useRouter` in a Client Component:

```tsx
// components/nav.tsx
'use client';

import { AbLink, usePathname, useRouter } from '@/i18n/navigation';

export function Nav() {
  const router = useRouter();
  const pathname = usePathname(); // without the locale prefix, e.g. '/cart'

  return (
    <nav>
      <AbLink href="/">Home</AbLink>
      <AbLink href="/cart">Cart</AbLink>
      <AbLink href={pathname} locale="fr">FR</AbLink>
      <button onClick={() => router.push('/cart')}>Open cart</button>
      <button onClick={() => router.replace(pathname, { locale: 'es' })}>ES</button>
    </nav>
  );
}
```

`getPathname` and `redirect` on the server:

```ts
// lib/urls.ts
import { getPathname, redirect } from '@/i18n/navigation';

export function cartUrl() {
  return getPathname({ href: '/cart', locale: 'fr' }); // '/fr/cart'
}

export function requireUser(user: unknown, locale: 'en' | 'fr' | 'es' | 'ru') {
  if (!user) redirect({ href: '/login', locale }); // '/login' or '/fr/login'...
}
```


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

Next.js 16 calls `middleware.ts` **`proxy.ts`**. The one `init` writes: locale detection, redirects and the cookie.

```ts
// proxy.ts
// Next.js 16 proxy (formerly middleware): locale detection, redirects and the NEXT_LOCALE cookie.
// To add an auth guard, pass `onRequest` (see the ab-nextjs-i18n README, "Proxy (with auth)").
import { createAbI18nProxy } from 'ab-nextjs-i18n/proxy';
import abI18nConfig from './i18n/config';

export default createAbI18nProxy(abI18nConfig);

export const config = {
  // Everything except API routes, Next.js / Vercel internals and files with an extension.
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
```

Composed with an auth guard (`onRequest` runs first, `onResponse` after the i18n proxy):

```ts
// proxy.ts
import { NextResponse } from 'next/server';
import { createAbI18nProxy } from 'ab-nextjs-i18n/proxy';
import { localizeAbPathname, stripAbLocalePrefix } from 'ab-nextjs-i18n/config';
import abI18nConfig from './i18n/config';

export default createAbI18nProxy(abI18nConfig, {
  // 1. runs first: send signed-out visitors of /account to the (localized) login page
  onRequest(request) {
    const path = stripAbLocalePrefix(request.nextUrl.pathname, abI18nConfig);
    if (path.startsWith('/account') && !request.cookies.has('session')) {
      const locale = abI18nConfig.locales.find((item) => request.nextUrl.pathname.startsWith(`/${item}/`)) ?? abI18nConfig.defaultLocale;
      return NextResponse.redirect(new URL(localizeAbPathname('/login', locale, abI18nConfig), request.url));
    }
  },
  // 2. runs after the i18n proxy: tweak the response
  onResponse(_request, response) {
    response.headers.set('x-frame-options', 'DENY');
  },
});

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
```

> NOTE: Only check cookies or headers here (no database calls). If your app already has a proxy, `init` leaves it alone and prints a merge snippet.


## Static rendering + metadata

`generateMetadata` with a translated title, a canonical URL and hreflang alternates:

```tsx
// app/[locale]/about/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAbLocale } from 'ab-nextjs-i18n/config';
import { getAbAlternates, getAbTranslations, setAbRequestLocale } from 'ab-nextjs-i18n/server';
import abI18nConfig from '@/i18n/config';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAbLocale(abI18nConfig, locale)) notFound(); // narrows `string` to your typed locales
  const t = await getAbTranslations({ locale, namespace: 'App' }); // explicit locale

  return {
    title: t('title'),
    // canonical for this locale + hreflang for every locale (and x-default)
    alternates: getAbAlternates(abI18nConfig, '/about', { locale, baseUrl: 'https://example.com' }),
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  if (!isAbLocale(abI18nConfig, locale)) notFound();
  setAbRequestLocale(locale);
  const t = await getAbTranslations('App');

  return <h1>{t('title')}</h1>;
}
```

`app/sitemap.ts` (one entry per path and locale, each with its alternates):

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next';
import { getAbSitemapEntries } from 'ab-nextjs-i18n/server';
import abI18nConfig from '@/i18n/config';

export default function sitemap(): MetadataRoute.Sitemap {
  return getAbSitemapEntries(abI18nConfig, ['/', { path: '/cart', changeFrequency: 'weekly', priority: 0.8 }], 'https://example.com');
}
```

**`next/root-params` (opt-in).** Next.js 16.3 can read the locale from the root params, so pages render statically without `setAbRequestLocale`. It only works when the root layout is `app/[locale]/layout.tsx`:

```ts
// i18n/request.ts
import { createAbRequestConfig } from 'ab-nextjs-i18n/server';
import * as rootParams from 'next/root-params';
import abI18nConfig from './config';

export default createAbRequestConfig({
  config: abI18nConfig,
  loadMessages: async (locale) => (await import(`../messages/${locale}.json`)).default,
  rootParam: () => rootParams.locale(),
});
```


## Typed messages

`init` writes `i18n/global.d.ts`, which types next-intl's `AppConfig` from your source messages and locales:

```ts
// i18n/global.d.ts
// Typed message keys and locales for next-intl (`useAbTranslations`, `getAbTranslations`, `AbLink`...).
import type abI18nConfig from './config';
import type messages from '../messages/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof abI18nConfig.locales)[number];
    Messages: typeof messages;
  }
}
```

It augments the `next-intl` module, so `next-intl` must be your app's own dependency (it's a peer of `ab-nextjs-i18n`); otherwise TypeScript can't see it and wrong keys aren't caught. A typo is then a type error:

```tsx
const t = useAbTranslations('App');
t('items', { count }); // ✅
t('itemz', { count }); // ❌
```

```text
components/cart-badge.tsx(11,10): error TS2345: Argument of type '"itemz"' is not assignable to parameter of
type 'NamespacedMessageKeys<{ App: { title: string; greeting: string; items: string; learnMore: string; }; ... }, "App">'.
```

> NOTE: Keys and namespaces are typed; the values passed to placeholders are not (run `check` for those).


## Message conventions

- ICU MessageFormat only, one JSON file per locale, namespaced by PascalCase keys (`App`, `Cart`...). JSON only in v1.
- **No LYD-style `(x)` placeholders**: run `npx ab-nextjs-i18n migrate` (see [`migrate`](#migrate)).

Placeholders, plurals, select, number and date arguments, and rich-text tags (`messages/en.json`):

```json
{
  "Cart": {
    "summary": "{count, plural, =0 {Your cart is empty} one {# item in your cart} other {# items in your cart}}",
    "owner": "{gender, select, female {Her cart} male {His cart} other {Their cart}}",
    "total": "Total: {total, number, ::currency/EUR}",
    "updated": "Updated on {date, date, medium}",
    "terms": "By paying, you accept our <terms>terms</terms> and <b>refund policy</b>."
  }
}
```

The same keys in French (plural categories follow each language: `ru` also has `few` and `many`):

```json
{
  "Cart": {
    "summary": "{count, plural, =0 {Votre panier est vide} one {# article dans votre panier} other {# articles dans votre panier}}",
    "owner": "{gender, select, female {Son panier} male {Son panier} other {Leur panier}}",
    "total": "Total : {total, number, ::currency/EUR}",
    "updated": "Mis à jour le {date, date, medium}",
    "terms": "En payant, vous acceptez nos <terms>conditions</terms> et notre <b>politique de remboursement</b>."
  }
}
```

Using them (`t.rich` turns each tag into a React element):

```tsx
// app/[locale]/cart/page.tsx
import { notFound } from 'next/navigation';
import { isAbLocale } from 'ab-nextjs-i18n/config';
import { getAbTranslations, setAbRequestLocale } from 'ab-nextjs-i18n/server';
import abI18nConfig from '@/i18n/config';
import { AbLink } from '@/i18n/navigation';

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAbLocale(abI18nConfig, locale)) notFound();
  setAbRequestLocale(locale);
  const t = await getAbTranslations('Cart');

  return (
    <section>
      <h1>{t('summary', { count: 3 })}</h1>
      <p>{t('owner', { gender: 'female' })}</p>
      <p>{t('total', { total: 42.5 })}</p>
      <p>{t('updated', { date: new Date('2026-10-03T12:00:00Z') })}</p>
      <p>
        {t.rich('terms', {
          terms: (chunks) => <AbLink href="/terms">{chunks}</AbLink>,
          b: (chunks) => <b>{chunks}</b>,
        })}
      </p>
    </section>
  );
}
```

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

The glossary (`messages/.ab-i18n-glossary.json`): words that are never translated, keys that `check` allows to stay identical to the source, and preferred terms (sent to LLM providers):

```json
{
  "doNotTranslate": ["abElements", "Next.js"],
  "allowIdentical": ["App.title"],
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

A `package.json` script:

```json
{
  "scripts": {
    "i18n:check": "ab-nextjs-i18n check --strict",
    "i18n:translate": "ab-nextjs-i18n translate"
  }
}
```

A GitHub Actions workflow that checks the messages on every pull request touching them:

```yaml
# .github/workflows/i18n.yml
name: i18n

on:
  pull_request:
    paths: ['messages/**']

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec ab-nextjs-i18n check --strict
```

| No. | Level | Checks |
|:----|:------|:-------|
| 1 | Error (exit 1) | missing keys, empty values, placeholder/tag mismatches, ICU syntax (icu-minify), type mismatches, invalid keys, missing or invalid files |
| 2 | Warning (exit 1 with `--strict`) | extra keys, identical to source (glossary allowlist), empty source, extra locale files |


## Migrating from next-intl / LYD

1. Keep `next-intl` in your dependencies (it's a peer of `ab-nextjs-i18n`, `^4.14.9`) and add `ab-nextjs-i18n` next to it.
2. Run `npx ab-nextjs-i18n init --dry-run` to see what would be created; existing files are never touched.
3. Move your locales into `i18n/config.ts`, and swap `next-intl/plugin` for `withAbI18n`.
4. If you have a `middleware.ts`, rename it to `proxy.ts` (`npx @next/codemod@canary middleware-to-proxy .`) and use `createAbI18nProxy`.
5. LYD messages: `npx ab-nextjs-i18n migrate` then `--write` to turn `(x)` into `{x}`, then `check`.
6. Use short locale codes (`en`, `fr`, `es`, `ru`).

From plain next-intl, the imports map one to one:

```ts
// before
import createNextIntlPlugin from 'next-intl/plugin';
import createMiddleware from 'next-intl/middleware';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';

// after
import { withAbI18n } from 'ab-nextjs-i18n/plugin'; // withAbI18n(nextConfig)
import { createAbI18nProxy } from 'ab-nextjs-i18n/proxy'; // createAbI18nProxy(abI18nConfig)
import { getAbTranslations, setAbRequestLocale } from 'ab-nextjs-i18n/server';
import { useAbTranslations } from 'ab-nextjs-i18n';
```

From LYD's `(x)` strings to ICU:

```tsx
// before: "greeting": "Hello, (x)!"
t('greeting').replace('(x)', user.name);

// after: "greeting": "Hello, {name}!"
t('greeting', { name: user.name });
```


## Publishing

Releases are published to npm by GitHub Actions ([publish.yml](./.github/workflows/publish.yml)) with Trusted Publishing (OIDC + provenance, no `NPM_TOKEN`).

> IMPORTANT: **v0.1.0 is published manually by the maintainer first** (with 2FA), so the npm trusted publisher can be linked to this repo. Every later version bump merged to `main` is published by the workflow.


## TODOs

- [ ] Expand plural categories for targets that need more than the source (e.g. `few` / `many` in `ru`)
- [ ] `check --usage` (unused / unknown keys in the source code)
- [ ] Typed placeholder values (next-intl's messages declaration)
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
