// ===== CONFIG LOADER ===== //
//
// Loads the app's `i18n/config.ts` (or `src/i18n/config.ts`) with Node's
// built-in type stripping (Node >= 22.18), so the CLI uses the same locales as
// the app. Falls back to reading the literals statically, then to the
// messages folder, then to the Ab defaults. CLI flags always win.

import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AB_I18N_DEFAULTS, defineAbI18n } from '../../config.js';
import { exists } from './fs-safe.mjs';
import { listMessageLocales } from './messages.mjs';

export const CONFIG_CANDIDATES = [
  'i18n/config.ts',
  'i18n/config.mts',
  'i18n/config.js',
  'i18n/config.mjs',
  'src/i18n/config.ts',
  'src/i18n/config.mts',
  'src/i18n/config.js',
  'src/i18n/config.mjs',
];

const pickConfig = (mod) => {
  for (const candidate of [mod?.abI18nConfig, mod?.default, mod?.config, mod?.i18nConfig]) {
    if (candidate && typeof candidate === 'object' && Array.isArray(candidate.locales)) return candidate;
  }
  return null;
};


/**
 * Imports the app's config without Node's noise about apps that lack
 * `"type": "module"` (MODULE_TYPELESS_PACKAGE_JSON) or about type stripping.
 */
async function importQuietly(url) {
  const original = process.emitWarning;
  process.emitWarning = function emitWarning(warning, ...args) {
    const options = args[0];
    const code = typeof options === 'object' && options !== null ? options.code : args[1];
    const text = String(warning?.message ?? warning);
    if (code === 'MODULE_TYPELESS_PACKAGE_JSON' || /^Module type of /.test(text) || /type stripping/i.test(text)) return;
    return original.call(process, warning, ...args);
  };
  try {
    return await import(url);
  } finally {
    process.emitWarning = original;
  }
}


/** Reads `locales`, `defaultLocale`, `sourceLocale`, `messagesDir` literals from source code. */
export function readConfigStatically(code) {
  const result = {};
  const locales = /\blocales\s*:\s*\[([^\]]*)\]/.exec(code);
  if (locales) {
    const items = [...locales[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
    if (items.length) result.locales = items;
  }
  for (const key of ['defaultLocale', 'sourceLocale', 'messagesDir', 'localePrefix']) {
    const match = new RegExp(`\\b${key}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`).exec(code);
    if (match) result[key] = match[1];
  }
  return result;
}


/**
 * @param {{ cwd: string, dir?: string, locales?: string[], source?: string, defaultLocale?: string }} options
 * @returns {Promise<{ root: string, locales: string[], defaultLocale: string, sourceLocale: string, messagesDir: string, messagesPath: string, configFile: string | null, origin: 'import' | 'static' | 'messages' | 'defaults', warnings: string[] }>}
 */
export async function loadAbI18nConfig(options) {
  const root = resolve(options.cwd ?? process.cwd());
  const warnings = [];
  let input = null;
  let origin = 'defaults';
  let configFile = null;

  for (const candidate of CONFIG_CANDIDATES) {
    const file = join(root, candidate);
    if (!(await exists(file))) continue;
    configFile = candidate;
    try {
      const mod = await importQuietly(pathToFileURL(file).href);
      input = pickConfig(mod);
      if (input) origin = 'import';
      else warnings.push(`${candidate} has no \`abI18nConfig\` / default export with \`locales\`; reading it statically.`);
    } catch (error) {
      warnings.push(`Couldn't import ${candidate} (${error.code ?? error.message}); reading it statically.`);
    }
    if (!input) {
      const parsed = readConfigStatically(await readFile(file, 'utf8'));
      if (parsed.locales) {
        input = parsed;
        origin = 'static';
      }
    }
    break;
  }

  let messagesDir = options.dir ?? input?.messagesDir;
  if (!messagesDir) {
    messagesDir = !(await exists(join(root, 'messages'))) && (await exists(join(root, 'src/messages'))) ? 'src/messages' : AB_I18N_DEFAULTS.messagesDir;
  }
  const messagesPath = isAbsolute(messagesDir) ? messagesDir : join(root, messagesDir);

  if (!input) {
    const fileLocales = await listMessageLocales(messagesPath);
    if (fileLocales.length) {
      const defaultLocale = fileLocales.includes('en') ? 'en' : fileLocales[0];
      input = { locales: [defaultLocale, ...fileLocales.filter((l) => l !== defaultLocale)], defaultLocale };
      origin = 'messages';
    }
  }

  const merged = {
    locales: options.locales ?? input?.locales ?? AB_I18N_DEFAULTS.locales,
    defaultLocale: options.defaultLocale ?? input?.defaultLocale,
    sourceLocale: options.source ?? input?.sourceLocale,
    localePrefix: input?.localePrefix,
  };
  if (merged.defaultLocale && !merged.locales.includes(merged.defaultLocale)) merged.defaultLocale = undefined;
  if (merged.sourceLocale && !merged.locales.includes(merged.sourceLocale)) {
    merged.locales = [merged.sourceLocale, ...merged.locales];
  }

  const config = defineAbI18n({ ...merged, messagesDir: relative(root, messagesPath) || '.' });
  return {
    root,
    locales: [...config.locales],
    defaultLocale: config.defaultLocale,
    sourceLocale: config.sourceLocale,
    localePrefix: config.localePrefix,
    messagesDir: config.messagesDir,
    messagesPath,
    configFile,
    origin,
    warnings,
  };
}
