// ===== `ab-nextjs-i18n check` ===== //
//
// CI guard for messages: missing / extra / empty keys, identical-to-source
// values, placeholder & tag mismatches, ICU syntax errors and plural categories
// missing for a locale (CLDR, via Intl.PluralRules).

import { readJson } from './lib/fs-safe.mjs';
import { readGlossary, isGlossaryOnly } from './lib/glossary.mjs';
import { diffIcuSignatures, getIcuSignature, getMissingPluralCategories, validateIcu } from './lib/icu-mask.mjs';
import { flattenMessages, listMessageLocales, messagesFile } from './lib/messages.mjs';
import { loadAbI18nConfig } from './lib/config-load.mjs';
import { bold, dim, green, red, splitList, table, yellow } from './lib/output.mjs';

export const CHECK_HELP = `
${bold('ab-nextjs-i18n check')} - validate messages (exit 1 on errors)

Options:
  --dir <path>        Messages folder (default: from i18n/config.ts, else messages)
  --locales <list>    Locales to check (default: from i18n/config.ts or the messages folder)
  --source <locale>   Source locale (default: sourceLocale / defaultLocale)
  --strict            Also fail on warnings (extra keys, identical values, empty source, plural categories)
  --format <fmt>      text | json (default: text)
  --cwd <path>        App root (default: current folder)

Errors:   missing-key, empty-value, placeholder-mismatch, icu-syntax, type-mismatch, invalid-key, missing-file, invalid-json
Warnings: extra-key, identical-to-source, empty-source, extra-file, plural-categories
`;

const kindOf = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);


/**
 * Checks the messages of every locale against the source locale.
 *
 * @returns {{ issues: Array<{ severity: 'error' | 'warning', code: string, locale: string, key?: string, message: string }>, locales: string[], sourceLocale: string }}
 */
export async function checkMessages({ messagesPath, locales, sourceLocale, glossary }) {
  const issues = [];
  const add = (severity, code, locale, key, message) => issues.push({ severity, code, locale, ...(key ? { key } : {}), message });

  const load = async (locale) => {
    try {
      const data = await readJson(messagesFile(messagesPath, locale), null);
      if (data === null) {
        add('error', 'missing-file', locale, null, `${locale}.json not found`);
        return null;
      }
      if (typeof data !== 'object' || Array.isArray(data)) {
        add('error', 'invalid-json', locale, null, `${locale}.json must contain a JSON object`);
        return null;
      }
      return data;
    } catch (error) {
      add('error', 'invalid-json', locale, null, error.message);
      return null;
    }
  };

  const validateMessage = (locale, key, value) => {
    if (typeof value !== 'string') return null;
    const result = validateIcu(value);
    if (!result.ok) {
      add('error', 'icu-syntax', locale, key, `invalid ICU message (${result.error})`);
      return null;
    }
    for (const { name, type, missing } of getMissingPluralCategories(value, locale)) {
      add('warning', 'plural-categories', locale, key, `{${name}, ${type}} lacks ${locale} categor${missing.length > 1 ? 'ies' : 'y'} ${missing.join(', ')}`);
    }
    return getIcuSignature(value);
  };

  const source = await load(sourceLocale);
  const sourceEntries = source ? flattenMessages(source) : [];
  const sourceMap = new Map(sourceEntries);
  const sourceSignatures = new Map();

  for (const [key, value] of sourceEntries) {
    if (key.split('.').some((part) => part === '' )) add('error', 'invalid-key', sourceLocale, key, 'empty key segment');
    if (typeof value === 'string' && value.trim() === '') add('warning', 'empty-source', sourceLocale, key, 'empty message in the source locale');
    const signature = validateMessage(sourceLocale, key, value);
    if (signature) sourceSignatures.set(key, signature);
  }
  for (const key of collectDottedKeys(source)) add('error', 'invalid-key', sourceLocale, key, 'keys must not contain "." (next-intl uses it for nesting)');

  for (const locale of locales) {
    if (locale === sourceLocale) continue;
    const target = await load(locale);
    if (!target || !source) continue;
    for (const key of collectDottedKeys(target)) add('error', 'invalid-key', locale, key, 'keys must not contain "."');

    const targetMap = new Map(flattenMessages(target));

    for (const [key, sourceValue] of sourceEntries) {
      if (!targetMap.has(key)) {
        add('error', 'missing-key', locale, key, 'missing translation');
        continue;
      }
      const value = targetMap.get(key);
      if (kindOf(value) !== kindOf(sourceValue)) {
        add('error', 'type-mismatch', locale, key, `expected ${kindOf(sourceValue)}, got ${kindOf(value)}`);
        continue;
      }
      if (typeof value !== 'string') continue;

      if (value.trim() === '' && sourceValue.trim() !== '') {
        add('error', 'empty-value', locale, key, 'empty translation');
        continue;
      }

      const signature = validateMessage(locale, key, value);
      const sourceSignature = sourceSignatures.get(key);
      if (signature && sourceSignature) {
        for (const problem of diffIcuSignatures(sourceSignature, signature)) add('error', 'placeholder-mismatch', locale, key, problem);
      }

      if (
        value === sourceValue &&
        /\p{L}/u.test(value) &&
        !glossary.allowIdentical.includes(key) &&
        !isGlossaryOnly(value, glossary)
      ) {
        add('warning', 'identical-to-source', locale, key, `same as ${sourceLocale} ("${value.length > 40 ? `${value.slice(0, 40)}…` : value}")`);
      }
    }

    for (const key of targetMap.keys()) {
      if (!sourceMap.has(key)) add('warning', 'extra-key', locale, key, `not in ${sourceLocale}.json`);
    }
  }

  return { issues, locales, sourceLocale };
}

function collectDottedKeys(messages, prefix = '', out = []) {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) return out;
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}/${key}` : key;
    if (key.includes('.')) out.push(path);
    if (value && typeof value === 'object' && !Array.isArray(value)) collectDottedKeys(value, path, out);
  }
  return out;
}


/**
 * Runs `check`.
 *
 * @returns { Promise<{ code: number, result: object }> }
 */
export async function runCheck(flags = {}, io = {}) {
  const log = io.log ?? ((line) => process.stdout.write(`${line}\n`));
  const json = flags.format === 'json';

  let config;
  try {
    config = await loadAbI18nConfig({ cwd: flags.cwd, dir: flags.dir, locales: splitList(flags.locales), source: flags.source });
  } catch (error) {
    if (json) log(JSON.stringify({ ok: false, error: error.message }, null, 2));
    else log(`✖ ${error.message}`);
    return { code: 2, result: { ok: false, error: error.message } };
  }

  const glossary = await readGlossary(config.messagesPath);
  const { issues } = await checkMessages({ messagesPath: config.messagesPath, locales: config.locales, sourceLocale: config.sourceLocale, glossary });

  // Message files for locales that aren't configured (config drift).
  const fileLocales = flags.locales ? [] : await listMessageLocales(config.messagesPath);
  for (const locale of fileLocales) {
    if (!config.locales.includes(locale)) issues.push({ severity: 'warning', code: 'extra-file', locale, message: `${locale}.json exists but ${locale} is not in locales` });
  }

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  const failed = errors > 0 || (flags.strict && warnings > 0);
  const result = {
    ok: !failed,
    strict: Boolean(flags.strict),
    sourceLocale: config.sourceLocale,
    locales: config.locales,
    messagesDir: config.messagesDir,
    configOrigin: config.origin,
    errors,
    warnings,
    issues,
  };

  if (json) {
    log(JSON.stringify(result, null, 2));
  } else {
    for (const warning of config.warnings) log(dim(`note: ${warning}`));
    log(`${bold('ab-nextjs-i18n check')} ${dim(`${config.messagesDir} · source ${config.sourceLocale} · ${config.locales.join(', ')}`)}`);
    if (issues.length) {
      log('');
      log(
        table(
          ['Severity', 'Locale', 'Key', 'Code', 'Message'],
          issues.map((issue) => [issue.severity === 'error' ? red('error') : yellow('warning'), issue.locale, issue.key ?? '', issue.code, issue.message]),
        ),
      );
    }
    log('');
    const summary = `${errors} error(s), ${warnings} warning(s)${flags.strict ? ' (strict)' : ''}`;
    log(failed ? red(`✖ ${summary}`) : green(`✔ ${summary}`));
  }

  return { code: failed ? 1 : 0, result };
}
