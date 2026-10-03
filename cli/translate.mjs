// ===== `ab-nextjs-i18n translate` ===== //
//
// Fills missing (and source-changed) messages with DeepL (default) or OpenAI
// (fallback). Hand-edited targets are never overwritten (reported as stale).

import { readFile } from 'node:fs/promises';
import { isAbLocaleTag } from '../config.js';
import { formatJson, readJson, writeFileAtomic } from './lib/fs-safe.mjs';
import { readGlossary } from './lib/glossary.mjs';
import { diffIcuSignatures, getIcuSignature, maskIcu, validateIcu } from './lib/icu-mask.mjs';
import { classifyTarget, hashMessage, readLock, writeLock } from './lib/lock.mjs';
import { flattenMessages, matchesKeyPatterns, messagesFile, orderLikeSource, unflattenMessages } from './lib/messages.mjs';
import { loadAbI18nConfig } from './lib/config-load.mjs';
import { redactSecrets, secretEnvValues, SECRET_ENV_KEYS } from './lib/redact.mjs';
import { bold, dim, green, markdownTable, red, splitList, table, yellow } from './lib/output.mjs';
import { resolveProviders } from './providers/index.mjs';

export const TRANSLATE_HELP = `
${bold('ab-nextjs-i18n translate')} - fill missing translations (DeepL, then OpenAI)

Options:
  --from <locale>      Source locale (default: sourceLocale / defaultLocale)
  --to <list>          Target locales (default: every other locale)
  --provider <list>    deepl | openai | google | libretranslate | trans | ./custom.mjs
                       (comma list = fallback chain; default: deepl,openai)
  --keys <patterns>    Only these keys, e.g. App,App.title,Nav.*
  --force              Re-translate machine-owned keys even when up to date (never hand edits)
  --prune              Remove target keys that aren't in the source
  --concurrency <n>    Parallel requests (default: 2)
  --dry-run            Show the plan; no requests, no writes
  --report <fmt>       md | json (printed to stdout)
  --dir <path>         Messages folder (default: from i18n/config.ts, else messages)
  --cwd <path>         App root (default: current folder)

Env (never commit keys): DEEPL_API_KEY, OPENAI_API_KEY, AB_I18N_OPENAI_MODEL,
                         GOOGLE_TRANSLATE_API_KEY, LIBRETRANSLATE_URL, LIBRETRANSLATE_API_KEY
`;

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

async function pool(tasks, concurrency) {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, tasks.length)) }, async () => {
    while (next < tasks.length) {
      const index = next++;
      await tasks[index]();
    }
  });
  await Promise.all(workers);
}

function checkTranslation(source, value) {
  const valid = validateIcu(value);
  if (!valid.ok) throw new Error(`invalid ICU (${valid.error})`);
  const problems = diffIcuSignatures(getIcuSignature(source), getIcuSignature(value));
  if (problems.length) throw new Error(problems.join('; '));
}


/**
 * Translates `jobs` through the provider chain (next provider = fallback for
 * failed batches and rejected messages).
 *
 * @returns { Promise<Map<string, { ok: boolean, value?: string, provider?: string, kind?: string, error?: string }>> }
 */
export async function translateJobs(jobs, chain, context) {
  const { from, to, glossary, env, fetch, sleep, concurrency = 2 } = context;
  // Provider errors can echo API keys: hide every key value the providers read (and key-shaped strings).
  const secrets = secretEnvValues(env ?? {}, [...SECRET_ENV_KEYS, ...chain.flatMap((provider) => provider.envKeys ?? [])]);
  const redact = (text) => redactSecrets(text, secrets);
  const results = new Map();
  let remaining = [];

  for (const job of jobs) {
    try {
      const masked = maskIcu(job.source, { terms: glossary.doNotTranslate });
      if (!masked.units.some((unit) => unit.translatable)) {
        results.set(job.key, { ok: true, value: job.source, provider: 'copy' });
      } else {
        remaining.push({ ...job, masked });
      }
    } catch (error) {
      results.set(job.key, { ok: false, kind: 'rejected', error: `source is not valid ICU (${error.code ?? error.message})` });
    }
  }

  for (const provider of chain) {
    if (remaining.length === 0) break;
    const units = [];
    for (const item of remaining) {
      item.translations = new Map();
      item.batchError = null;
      for (const unit of item.masked.units) if (unit.translatable) units.push({ item, unit });
    }

    const tasks = chunk(units, provider.batchSize || 25).map((batch) => async () => {
      try {
        const out = await provider.translate({ texts: batch.map(({ unit }) => unit.text), from, to, glossary, env, fetch, sleep });
        if (!Array.isArray(out) || out.length !== batch.length) {
          throw new Error(`returned ${Array.isArray(out) ? out.length : 'no'} translations for ${batch.length} texts`);
        }
        batch.forEach(({ item, unit }, index) => item.translations.set(unit.id, String(out[index])));
      } catch (error) {
        for (const { item } of batch) item.batchError = redact(error?.message ?? error);
      }
    });
    await pool(tasks, concurrency);

    const next = [];
    for (const item of remaining) {
      if (item.batchError) {
        item.lastError = `${provider.name}: ${item.batchError}`;
        item.kind = 'failed';
        next.push(item);
        continue;
      }
      try {
        const value = item.masked.rebuild(item.translations);
        checkTranslation(item.source, value);
        results.set(item.key, { ok: true, value, provider: provider.name });
      } catch (error) {
        item.lastError = redact(`${provider.name}: ${error.message}`);
        item.kind = 'rejected';
        next.push(item);
      }
    }
    remaining = next;
  }

  for (const item of remaining) results.set(item.key, { ok: false, kind: item.kind ?? 'failed', error: item.lastError });
  return results;
}


/**
 * Runs `translate`.
 *
 * @param { object } flags
 * @param {{ log?: Function, env?: object, fetch?: typeof fetch, sleep?: Function, providers?: object[] }} [io]
 * @returns { Promise<{ code: number, report: object }> }
 */
export async function runTranslate(flags = {}, io = {}) {
  const log = io.log ?? ((line) => process.stdout.write(`${line}\n`));
  const env = io.env ?? process.env;
  const dryRun = Boolean(flags['dry-run']);
  const reportFormat = flags.report;

  const fail = (rawMessage) => {
    const message = redactSecrets(rawMessage, secretEnvValues(env, SECRET_ENV_KEYS));
    if (reportFormat === 'json') log(JSON.stringify({ ok: false, error: message }, null, 2));
    else log(`✖ ${message}`);
    return { code: 2, report: { ok: false, error: message } };
  };
  if (reportFormat && !['md', 'json'].includes(reportFormat)) return fail('--report must be md or json.');

  let config;
  try {
    config = await loadAbI18nConfig({ cwd: flags.cwd, dir: flags.dir, source: flags.from });
  } catch (error) {
    return fail(error.message);
  }
  const from = flags.from ?? config.sourceLocale;
  const targets = splitList(flags.to) ?? config.locales.filter((locale) => locale !== from);
  const badLocale = [from, ...targets].find((locale) => !isAbLocaleTag(locale));
  if (badLocale) return fail(`Invalid locale "${badLocale}".`);
  if (targets.includes(from)) return fail('--to must not include the source locale.');
  const keyPatterns = splitList(flags.keys);
  const concurrency = Math.max(1, Number(flags.concurrency ?? 2) || 2);

  const source = await readJson(messagesFile(config.messagesPath, from), null).catch((error) => error);
  if (source instanceof Error) return fail(source.message);
  if (!source) return fail(`${config.messagesDir}/${from}.json not found.`);
  const sourceEntries = flattenMessages(source);

  const glossary = await readGlossary(config.messagesPath);
  const lock = await readLock(config.messagesPath);
  const lockUsable = !lock.sourceLocale || lock.sourceLocale === from;
  const warnings = [...config.warnings];
  if (!lockUsable) warnings.push(`The lock was written for source "${lock.sourceLocale}", not "${from}": existing translations are treated as hand-written.`);

  // 1. Plan every locale (no provider, no key needed).
  const plans = [];
  for (const to of targets) {
    const file = messagesFile(config.messagesPath, to);
    const originalText = await readFile(file, 'utf8').catch((error) => (error.code === 'ENOENT' ? null : Promise.reject(error)));
    const target = originalText === null ? {} : JSON.parse(originalText);
    const targetMap = new Map(flattenMessages(target));
    const lockEntries = lockUsable ? (lock.locales[to] ?? {}) : {};
    const newLock = {};
    const jobs = [];
    const result = {
      locale: to,
      created: originalText === null,
      planned: [],
      translated: [],
      rejected: [],
      failed: [],
      stale: [],
      handEdited: [],
      copied: [],
      conflicts: [],
      extra: [],
      pruned: [],
      written: false,
    };

    for (const [key, sourceValue] of sourceEntries) {
      if (!matchesKeyPatterns(key, keyPatterns)) {
        if (lockEntries[key]) newLock[key] = lockEntries[key];
        continue;
      }
      if (typeof sourceValue !== 'string') {
        // Arrays, numbers, booleans: copied when missing, never translated.
        if (!targetMap.has(key)) {
          targetMap.set(key, structuredClone(sourceValue));
          result.copied.push(key);
        }
        continue;
      }
      const current = targetMap.get(key);
      if (current !== undefined && typeof current !== 'string') {
        result.conflicts.push({ key, reason: 'target is not a string' });
        continue;
      }
      const decision = classifyTarget({ sourceHash: hashMessage(sourceValue), target: current, entry: lockEntries[key], force: Boolean(flags.force) });
      if (decision.action === 'translate') {
        jobs.push({ key, source: sourceValue, reason: decision.reason });
        if (lockEntries[key]) newLock[key] = lockEntries[key];
      } else {
        newLock[key] = decision.entry;
        if (decision.action === 'stale') result.stale.push({ key, reason: decision.reason });
        else if (decision.reason === 'hand-edited') result.handEdited.push(key);
      }
    }
    result.planned = jobs.map(({ key, reason }) => ({ key, reason }));
    plans.push({ to, file, originalText, targetMap, newLock, jobs, result });
  }

  // 2. Providers (and their keys) are only resolved when something needs translating.
  let chain = [];
  if (!dryRun && plans.some((plan) => plan.jobs.length)) {
    try {
      chain = io.providers ?? (await resolveProviders(flags.provider, { cwd: config.root, env }));
    } catch (error) {
      return fail(error.message);
    }
  }

  const report = { ok: true, dryRun, from, providers: chain.map((p) => p.name), messagesDir: config.messagesDir, warnings, locales: [] };
  let lockChanged = false;

  // 3. Translate and write.
  for (const { to, file, originalText, targetMap, newLock, jobs, result } of plans) {
    if (!dryRun && jobs.length) {
      const outcomes = await translateJobs(jobs, chain, { from, to, glossary, env, fetch: io.fetch, sleep: io.sleep, concurrency });
      for (const job of jobs) {
        const outcome = outcomes.get(job.key);
        if (outcome.ok) {
          targetMap.set(job.key, outcome.value);
          newLock[job.key] = { source: hashMessage(job.source), target: hashMessage(outcome.value), origin: outcome.provider };
          result.translated.push({ key: job.key, reason: job.reason, provider: outcome.provider });
        } else {
          result[outcome.kind === 'rejected' ? 'rejected' : 'failed'].push({ key: job.key, error: outcome.error });
        }
      }
    }

    const { entries, extra } = orderLikeSource(sourceEntries, targetMap, { prune: Boolean(flags.prune) });
    if (flags.prune) result.pruned = extra;
    else result.extra = extra;

    if (!dryRun) {
      const output = formatJson(unflattenMessages(entries));
      if (output !== originalText) {
        await writeFileAtomic(file, output);
        result.written = true;
      }
      if (JSON.stringify(newLock) !== JSON.stringify(lock.locales[to] ?? {})) lockChanged = true;
      lock.locales[to] = newLock;
    }
    report.locales.push(result);
  }

  if (!dryRun && (lockChanged || lock.sourceLocale !== from)) {
    lock.sourceLocale = from;
    await writeLock(config.messagesPath, lock);
  }

  const problems = report.locales.reduce((sum, item) => sum + item.rejected.length + item.failed.length, 0);
  report.ok = problems === 0;
  printReport(report, reportFormat, log);
  return { code: problems ? 1 : 0, report };
}


function printReport(report, format, log) {
  if (format === 'json') {
    log(JSON.stringify(report, null, 2));
    return;
  }

  const headers = report.dryRun
    ? ['Locale', 'To translate', 'Stale', 'Hand-edited', 'Copied', report.locales.some((l) => l.pruned.length) ? 'Pruned' : 'Extra kept']
    : ['Locale', 'Translated', 'Rejected', 'Failed', 'Stale', 'Hand-edited', 'Copied', report.locales.some((l) => l.pruned.length) ? 'Pruned' : 'Extra kept'];
  const rows = report.locales.map((l) => {
    const extra = (l.pruned.length || l.extra.length).toString();
    return report.dryRun
      ? [l.locale, l.planned.length, l.stale.length, l.handEdited.length, l.copied.length, extra]
      : [l.locale, l.translated.length, l.rejected.length, l.failed.length, l.stale.length, l.handEdited.length, l.copied.length, extra];
  });
  const details = [];
  for (const l of report.locales) {
    for (const item of l.rejected) details.push([l.locale, item.key, 'rejected', item.error]);
    for (const item of l.failed) details.push([l.locale, item.key, 'failed', item.error]);
    for (const item of l.stale) details.push([l.locale, item.key, 'stale', item.reason]);
    for (const item of l.conflicts) details.push([l.locale, item.key, 'conflict', item.reason]);
    if (report.dryRun) for (const item of l.planned) details.push([l.locale, item.key, 'to translate', item.reason]);
  }

  if (format === 'md') {
    log(`## ab-nextjs-i18n translate${report.dryRun ? ' (dry run)' : ''}\n`);
    log(`Source: \`${report.from}\` · providers: ${report.providers.join(' → ') || '-'}\n`);
    log(markdownTable(headers, rows));
    if (details.length) log(`\n### Details\n\n${markdownTable(['Locale', 'Key', 'Status', 'Note'], details)}`);
    for (const warning of report.warnings) log(`\n> ⚠ ${warning}`);
    return;
  }

  log(`${bold('ab-nextjs-i18n translate')} ${dim(`${report.messagesDir} · from ${report.from}${report.dryRun ? ' · dry run, nothing sent or written' : ` · ${report.providers.join(' → ') || 'nothing to translate'}`}`)}`);
  for (const warning of report.warnings) log(yellow(`⚠ ${warning}`));
  log('');
  log(table(headers, rows));
  if (details.length) {
    log('');
    log(table(['Locale', 'Key', 'Status', 'Note'], details.map(([a, b, status, d]) => [a, b, status === 'rejected' || status === 'failed' ? red(status) : yellow(status), d])));
  }
  log('');
  log(report.ok ? green(report.dryRun || report.providers.length ? '✔ Done.' : '✔ Nothing to translate.') : red('✖ Some messages were not translated (see above).'));
}
