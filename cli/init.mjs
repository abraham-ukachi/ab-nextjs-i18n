// ===== `ab-nextjs-i18n init` ===== //
//
// Creates only the files that are missing. Never overwrites, never edits
// next.config / package.json / tsconfig, never moves `app/`: it prints the steps.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AB_LOCALE_PREFIXES, isAbLocaleTag } from '../config.js';
import { exists, formatJson, readJson, writeFileIfMissing } from './lib/fs-safe.mjs';
import { addCommand, detectPackageManager } from './lib/pm-detect.mjs';
import { bold, cyan, dim, green, splitList, table, yellow } from './lib/output.mjs';

/** The next-intl range ab-nextjs-i18n expects as a peer dependency (the app installs it). */
const NEXT_INTL_RANGE = createRequire(import.meta.url)('../package.json').peerDependencies['next-intl'];

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const STARTER_LOCALES = ['en', 'fr', 'es', 'ru'];
const MIN_NEXT = [16, 3];
/** Extensions Next.js accepts for proxy / middleware files. */
const PROXY_EXTENSIONS = ['ts', 'js', 'mts', 'mjs'];

export const INIT_HELP = `
${bold('ab-nextjs-i18n init')} - add i18n to a Next.js app (only creates missing files)

Options:
  --locales <list>   Comma-separated locales (default: en,fr,es,ru)
  --default <locale> Default locale (default: en)
  --dir <path>       Messages folder, relative to the app root (default: messages)
  --prefix <mode>    as-needed | always | never (default: as-needed)
  --src / --no-src   Put i18n/ and proxy.ts in src/ (default: auto, src/ when src/app exists)
  --cwd <path>       App root (default: current folder)
  --dry-run          Show what would be created, write nothing
  --json             Print a JSON report
  --yes              Continue even when no Next.js app is detected
`;

const toPosix = (path) => path.split(sep).join('/');

function parseVersion(spec) {
  const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(spec ?? ''));
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)] : null;
}

const render = (template, vars) => template.replace(/\{\{([A-Z_]+)\}\}/g, (_, name) => vars[name] ?? '');

function relativeImport(fromDir, target) {
  const path = toPosix(relative(fromDir, target)) || '.';
  return path.startsWith('.') ? path : `./${path}`;
}


/** Builds the starter messages of `locale` (fresh Ab starters; `{}` for unknown locales). */
export async function starterMessages(locale, sourceLocale) {
  if (STARTER_LOCALES.includes(locale)) return readFile(join(TEMPLATES, 'messages', `${locale}.json`), 'utf8');
  // The source locale needs content: fall back to the English starters.
  if (locale === sourceLocale) return readFile(join(TEMPLATES, 'messages', 'en.json'), 'utf8');
  return formatJson({});
}


/**
 * Runs `init`.
 *
 * @param {{ cwd?: string, locales?: string, default?: string, dir?: string, prefix?: string, src?: boolean, 'dry-run'?: boolean, json?: boolean, yes?: boolean }} flags
 * @param {{ log?: (line: string) => void }} [io]
 * @returns { Promise<{ code: number, report: object }> }
 */
export async function runInit(flags = {}, io = {}) {
  const log = io.log ?? ((line) => process.stdout.write(`${line}\n`));
  const root = resolve(flags.cwd ?? process.cwd());
  const dryRun = Boolean(flags['dry-run']);
  const warnings = [];

  // ----- options ----- //
  const locales = splitList(flags.locales) ?? [...STARTER_LOCALES];
  const defaultLocale = flags.default ?? (locales.includes('en') ? 'en' : locales[0]);
  const prefix = flags.prefix ?? 'as-needed';
  const messagesDir = toPosix(flags.dir ?? 'messages').replace(/\/+$/, '');
  const fail = (message) => {
    if (flags.json) log(JSON.stringify({ ok: false, error: message }, null, 2));
    else log(`✖ ${message}`);
    return { code: 2, report: { ok: false, error: message } };
  };

  if (locales.length === 0) return fail('--locales is empty.');
  const invalid = locales.filter((locale) => !isAbLocaleTag(locale));
  if (invalid.length) return fail(`Invalid locale(s): ${invalid.join(', ')}. Use short BCP 47 tags such as en, fr or pt-BR.`);
  if (new Set(locales).size !== locales.length) return fail('--locales contains duplicates.');
  if (!locales.includes(defaultLocale)) return fail(`--default "${defaultLocale}" is not in --locales (${locales.join(', ')}).`);
  if (!AB_LOCALE_PREFIXES.includes(prefix)) return fail(`--prefix must be one of ${AB_LOCALE_PREFIXES.join(', ')}.`);
  if (messagesDir.startsWith('/') || messagesDir.split('/').includes('..')) return fail('--dir must be a folder inside the app.');

  // ----- detect the app ----- //
  const pkg = await readJson(join(root, 'package.json'), null).catch(() => null);
  let nextVersion = null;
  const installedNext = await readJson(join(root, 'node_modules', 'next', 'package.json'), null).catch(() => null);
  if (installedNext?.version) nextVersion = installedNext.version;
  else nextVersion = pkg?.dependencies?.next ?? pkg?.devDependencies?.next ?? null;

  if (!pkg) {
    if (!flags.yes) return fail(`No package.json in ${root}. Run init in your Next.js app (or pass --cwd / --yes).`);
    warnings.push('No package.json found.');
  } else if (!nextVersion) {
    if (!flags.yes) return fail('`next` is not a dependency of this app. Pass --yes to continue anyway.');
    warnings.push('`next` is not a dependency of this app.');
  }
  const parsedNext = parseVersion(nextVersion);
  if (parsedNext && (parsedNext[0] < MIN_NEXT[0] || (parsedNext[0] === MIN_NEXT[0] && parsedNext[1] < MIN_NEXT[1]))) {
    warnings.push(`Next.js ${nextVersion} detected: ab-nextjs-i18n targets Next.js >= 16.3 (proxy.ts, next/root-params).`);
  }

  const hasSrcApp = await exists(join(root, 'src', 'app'));
  const hasApp = await exists(join(root, 'app'));
  const useSrc = flags.src ?? (hasSrcApp && !hasApp);
  const appDir = useSrc ? 'src/app' : 'app';
  if (!hasSrcApp && !hasApp) warnings.push('No app/ (or src/app/) folder found: ab-nextjs-i18n is for the App Router.');

  const packageManager = await detectPackageManager(root, pkg);
  const base = useSrc ? 'src' : '.';
  const i18nDir = join(root, base, 'i18n');
  const messagesPath = join(root, messagesDir);

  // ----- plan ----- //
  const vars = {
    LOCALES: locales.map((locale) => `'${locale}'`).join(', '),
    DEFAULT_LOCALE: defaultLocale,
    SOURCE_LOCALE: defaultLocale,
    PREFIX: prefix,
    MESSAGES_DIR: messagesDir,
    MESSAGES_IMPORT: relativeImport(i18nDir, messagesPath),
    CONFIG_IMPORT: relativeImport(join(root, base), join(i18nDir, 'config')),
  };
  const template = async (name) => render(await readFile(join(TEMPLATES, name), 'utf8'), vars);

  const plan = [];
  for (const locale of locales) {
    plan.push({ path: join(messagesPath, `${locale}.json`), contents: () => starterMessages(locale, defaultLocale) });
  }
  plan.push({ path: join(messagesPath, '.ab-i18n-glossary.json'), contents: () => readFile(join(TEMPLATES, 'messages', '.ab-i18n-glossary.json'), 'utf8') });
  plan.push({ path: join(i18nDir, 'config.ts'), contents: () => template('i18n/config.ts.tpl') });
  plan.push({ path: join(i18nDir, 'request.ts'), contents: () => template('i18n/request.ts.tpl') });
  plan.push({ path: join(i18nDir, 'navigation.ts'), contents: () => template('i18n/navigation.ts.tpl') });
  plan.push({ path: join(i18nDir, 'global.d.ts'), contents: () => template('i18n/global.d.ts.tpl') });

  // proxy.ts: only when no proxy / middleware file exists (any extension, root or src/).
  const candidates = (name) => ['', 'src/'].flatMap((dir) => PROXY_EXTENSIONS.map((ext) => `${dir}${name}.${ext}`));
  const proxyCandidates = candidates('proxy');
  const middlewareCandidates = candidates('middleware');
  const existingProxy = (await Promise.all(proxyCandidates.map(async (p) => ((await exists(join(root, p))) ? p : null)))).find(Boolean);
  const existingMiddleware = (await Promise.all(middlewareCandidates.map(async (p) => ((await exists(join(root, p))) ? p : null)))).find(Boolean);
  const proxyPath = join(root, base, 'proxy.ts');
  let proxyNote = null;
  if (existingProxy) {
    proxyNote = { file: existingProxy, kind: 'proxy' };
  } else if (existingMiddleware) {
    proxyNote = { file: existingMiddleware, kind: 'middleware' };
  } else {
    plan.push({ path: proxyPath, contents: () => template('proxy.ts.tpl') });
  }

  // ----- apply ----- //
  const files = [];
  for (const item of plan) {
    const rel = toPosix(relative(root, item.path));
    if (await exists(item.path)) {
      files.push({ path: rel, status: 'skipped', reason: 'exists' });
      continue;
    }
    if (dryRun) {
      files.push({ path: rel, status: 'would-create' });
      continue;
    }
    const created = await writeFileIfMissing(item.path, await item.contents());
    files.push(created ? { path: rel, status: 'created' } : { path: rel, status: 'skipped', reason: 'exists' });
  }
  if (proxyNote) {
    files.push({ path: toPosix(relative(root, proxyPath)), status: 'skipped', reason: `${proxyNote.file} exists` });
  }

  // ----- next steps ----- //
  const hasDependency = Boolean(pkg?.dependencies?.['ab-nextjs-i18n'] ?? pkg?.devDependencies?.['ab-nextjs-i18n']);
  const configImport = `./${useSrc ? 'src/' : ''}i18n/config`;
  const nextSteps = [];
  const hasNextIntl = Boolean(pkg?.dependencies?.['next-intl'] ?? pkg?.devDependencies?.['next-intl']);
  // next-intl is a peer dependency: the app owns it (one instance for the app, the
  // typed keys in i18n/global.d.ts and ab-nextjs-i18n).
  const toInstall = [...(hasDependency ? [] : ['ab-nextjs-i18n']), ...(hasNextIntl ? [] : ['next-intl'])];
  if (toInstall.length > 0) {
    const peerNote = hasNextIntl ? '' : ` (next-intl ${NEXT_INTL_RANGE} is a peer dependency: your app installs it itself)`;
    nextSteps.push(`Install ${toInstall.join(' and ')}${peerNote}:
    ${addCommand(packageManager, toInstall)}`);
  }
  nextSteps.push(`Wrap next.config with the plugin (it also adds ab-nextjs-i18n to transpilePackages):
    import { withAbI18n } from 'ab-nextjs-i18n/plugin';
    export default withAbI18n(nextConfig);`);
  nextSteps.push(`Move your routes into ${appDir}/[locale]/ (layout.tsx, page.tsx, not-found.tsx...). Keep manifest.ts, sitemap.ts and robots.ts in ${appDir}/.
    ${appDir}/[locale]/layout.tsx must be the root layout (delete ${appDir}/layout.tsx): i18n/request.ts reads the locale from next/root-params.`);
  nextSteps.push(`In ${appDir}/[locale]/layout.tsx:
    import { AbI18nProvider } from 'ab-nextjs-i18n';
    import { generateAbStaticParams } from 'ab-nextjs-i18n/server';
    import abI18nConfig from '@/i18n/config';
    export const generateStaticParams = () => generateAbStaticParams(abI18nConfig);
    // <html lang={locale}> ... <AbI18nProvider config={abI18nConfig}>{children}</AbI18nProvider>`);
  if (proxyNote?.kind === 'proxy') {
    nextSteps.push(`${proxyNote.file} already exists, so it wasn't touched. Merge the i18n proxy into it:
    import { createAbI18nProxy } from 'ab-nextjs-i18n/proxy';
    import abI18nConfig from '${configImport}';
    const i18nProxy = createAbI18nProxy(abI18nConfig, { onRequest: yourExistingLogic });
    export default i18nProxy;
    export const config = { matcher: '/((?!api|trpc|_next|_vercel|.*\\\\..*).*)' };`);
  } else if (proxyNote?.kind === 'middleware') {
    nextSteps.push(`${proxyNote.file} is deprecated in Next.js 16 (renamed to proxy.ts), so no proxy.ts was written. Migrate it first:
    npx @next/codemod@canary middleware-to-proxy .
    then merge createAbI18nProxy (ab-nextjs-i18n/proxy) into the resulting proxy.ts (see the README, "Proxy (with auth)").`);
  }
  nextSteps.push(`Check your messages in CI: npx ab-nextjs-i18n check`);

  const report = {
    ok: true,
    dryRun,
    root,
    nextVersion,
    packageManager,
    src: useSrc,
    locales,
    defaultLocale,
    localePrefix: prefix,
    messagesDir,
    files,
    warnings,
    nextSteps,
  };

  // ----- print ----- //
  if (flags.json) {
    log(JSON.stringify(report, null, 2));
    return { code: 0, report };
  }

  const statusLabel = (file) => {
    if (file.status === 'created') return green('created');
    if (file.status === 'would-create') return cyan('would create');
    return yellow(`skipped (${file.reason})`);
  };
  log(`${bold('ab-nextjs-i18n init')}${dryRun ? dim(' (dry run, nothing written)') : ''}`);
  log(dim(`root: ${root} · next: ${nextVersion ?? 'not found'} · ${packageManager} · ${useSrc ? 'src/' : 'root'} layout`));
  log('');
  log(table(['File', 'Status'], files.map((file) => [file.path, statusLabel(file)])));
  for (const warning of warnings) log(`\n${yellow('⚠')} ${warning}`);
  log(`\n${bold('Next steps')}`);
  nextSteps.forEach((step, index) => log(`${index + 1}. ${step}`));
  return { code: 0, report };
}
