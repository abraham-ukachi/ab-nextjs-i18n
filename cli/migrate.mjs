// ===== `ab-nextjs-i18n migrate` ===== //
//
// Rewrites LYD-style `(x)` placeholders to ICU `{x}`. Dry run by default.
//
// Heuristic (a `(name)` is only rewritten when all of these hold):
//  1. `name` is a single identifier starting with a lowercase letter: `(x)`, `(m)`, `(count)`.
//  2. It isn't glued to a word: `item(s)`, `ami(e)s` and `(s)he` are left alone.
//  3. Single letters are placeholders, except enumerations: a string containing
//     `(a)` + `(b)` or `(i)` + `(ii)` is left alone.
//  4. Multi-letter names (`(optional)`, `(beta)`, `(name)`) are only rewritten when
//     they appear unchanged in the same key of every other locale file that has that
//     key (real words get translated, placeholders don't), or when listed in `--names`.
//     With a single locale file they're reported as ambiguous.
//  5. `--ignore` names are never rewritten, and a rewrite that would produce invalid
//     ICU is skipped.

import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { writeFileAtomic } from './lib/fs-safe.mjs';
import { validateIcu } from './lib/icu-mask.mjs';
import { flattenMessages, listMessageLocales, mapMessages, messagesFile } from './lib/messages.mjs';
import { loadAbI18nConfig } from './lib/config-load.mjs';
import { bold, dim, green, splitList, table, yellow } from './lib/output.mjs';

export const MIGRATE_HELP = `
${bold('ab-nextjs-i18n migrate')} - rewrite LYD (x) placeholders to ICU {x} (dry run by default)

Options:
  --dir <path>       Messages folder (default: from i18n/config.ts, else messages)
  --write            Apply the changes (atomic writes)
  --names <list>     Always treat these multi-letter names as placeholders, e.g. --names name,count
  --ignore <list>    Never rewrite these names, e.g. --ignore beta,optional
  --json             Print a JSON report
  --cwd <path>       App root (default: current folder)
`;

const PLACEHOLDER = /\(([a-z][a-zA-Z0-9_]*)\)/g;
const WORD_CHAR = /[\p{L}\p{N}_]/u;


/**
 * Finds the `(x)` tokens of one message and decides which ones to rewrite.
 *
 * @param { string } value
 * @param {{ otherValues?: string[], names?: string[], ignore?: string[] }} [context]
 * @returns {{ result: string, rewritten: string[], skipped: Array<{ token: string, reason: string }> }}
 */
export function migrateMessage(value, context = {}) {
  const { otherValues = [], names = [], ignore = [] } = context;
  const matches = [...value.matchAll(PLACEHOLDER)];
  if (matches.length === 0) return { result: value, rewritten: [], skipped: [] };

  const tokens = new Set(matches.map((match) => match[1]));
  const enumeration = (tokens.has('a') && tokens.has('b')) || (tokens.has('i') && tokens.has('ii'));
  const rewritten = [];
  const skipped = [];
  let result = '';
  let last = 0;

  for (const match of matches) {
    const [token, name] = match;
    const before = value[match.index - 1];
    const after = value[match.index + token.length];
    let reason = null;

    if (ignore.includes(name)) reason = 'ignored (--ignore)';
    else if ((before && WORD_CHAR.test(before)) || (after && WORD_CHAR.test(after))) reason = 'glued to a word (e.g. item(s))';
    else if (names.includes(name)) reason = null;
    else if (name.length === 1 || name === 'ii') {
      if (enumeration) reason = 'looks like an enumeration ((a), (b)...)';
    } else if (otherValues.length === 0) {
      reason = 'ambiguous: a word in parentheses? (pass --names to force)';
    } else if (!otherValues.every((other) => other.includes(token))) {
      reason = 'translated in other locales, so it is a word, not a placeholder';
    }

    result += value.slice(last, match.index);
    if (reason) {
      skipped.push({ token, reason });
      result += token;
    } else {
      rewritten.push(name);
      result += `{${name}}`;
    }
    last = match.index + token.length;
  }
  result += value.slice(last);

  if (rewritten.length && !validateIcu(result).ok) {
    return { result: value, rewritten: [], skipped: [...skipped, ...rewritten.map((name) => ({ token: `(${name})`, reason: 'rewrite would produce invalid ICU' }))] };
  }
  return { result, rewritten, skipped };
}


const detectIndent = (text) => /^([ \t]+)"/m.exec(text)?.[1] ?? '  ';


/**
 * Runs `migrate`.
 *
 * @returns { Promise<{ code: number, report: object }> }
 */
export async function runMigrate(flags = {}, io = {}) {
  const log = io.log ?? ((line) => process.stdout.write(`${line}\n`));
  const config = await loadAbI18nConfig({ cwd: flags.cwd, dir: flags.dir });
  const names = splitList(flags.names) ?? [];
  const ignore = splitList(flags.ignore) ?? [];
  const write = Boolean(flags.write);

  const locales = await listMessageLocales(config.messagesPath);
  const files = new Map();
  for (const locale of locales) {
    const path = messagesFile(config.messagesPath, locale);
    const text = await readFile(path, 'utf8');
    const data = JSON.parse(text);
    files.set(locale, { path, text, data, entries: flattenMessages(data) });
  }
  const maps = new Map([...files].map(([locale, file]) => [locale, new Map(file.entries)]));

  const changes = [];
  const skipped = [];
  const written = [];

  for (const [locale, file] of files) {
    let changed = false;
    const updated = mapMessages(file.data, (key, value) => {
      if (typeof value !== 'string') return value;
      const otherValues = [...maps]
        .filter(([other]) => other !== locale)
        .map(([, map]) => map.get(key))
        .filter((other) => typeof other === 'string');
      const outcome = migrateMessage(value, { otherValues, names, ignore });
      for (const skip of outcome.skipped) skipped.push({ locale, key, ...skip });
      if (outcome.result !== value) {
        changed = true;
        changes.push({ locale, key, from: value, to: outcome.result, placeholders: outcome.rewritten });
      }
      return outcome.result;
    });

    if (changed && write) {
      const indent = detectIndent(file.text);
      const json = JSON.stringify(updated, null, indent);
      await writeFileAtomic(file.path, file.text.endsWith('\n') ? `${json}\n` : json);
      written.push(relative(config.root, file.path));
    }
  }

  const report = {
    ok: true,
    write,
    messagesDir: config.messagesDir,
    locales,
    changes,
    skipped,
    written,
  };

  if (flags.json) {
    log(JSON.stringify(report, null, 2));
    return { code: 0, report };
  }

  log(`${bold('ab-nextjs-i18n migrate')} ${dim(`${config.messagesDir} · ${write ? 'write' : 'dry run (pass --write to apply)'}`)}`);
  if (changes.length) {
    log('');
    log(table(['Locale', 'Key', 'Before', 'After'], changes.map((change) => [change.locale, change.key, change.from, change.to])));
  }
  if (skipped.length) {
    log(`\n${yellow('Skipped')}`);
    log(table(['Locale', 'Key', 'Token', 'Why'], skipped.map((skip) => [skip.locale, skip.key, skip.token, skip.reason])));
  }
  log('');
  log(
    write
      ? green(`✔ ${changes.length} message(s) rewritten in ${written.length} file(s).`)
      : green(`✔ ${changes.length} message(s) would be rewritten. Nothing was written.`),
  );
  if (changes.length) {
    log(dim("Then update the code: `t('key').replace('(x)', value)` → `t('key', { x: value })`."));
  }
  return { code: 0, report };
}
