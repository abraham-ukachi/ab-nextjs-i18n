import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { makeTempApp, readJsonFile, removeDir, runCli, writeJsonFile } from './helpers';

let dir: string;
beforeEach(async () => {
  dir = await makeTempApp();
  await runCli(['init'], dir);
});
afterEach(async () => {
  await removeDir(dir);
});

const edit = async (locale: string, fn: (messages: any) => void) => {
  const file = join(dir, 'messages', `${locale}.json`);
  const messages = await readJsonFile(file);
  fn(messages);
  await writeJsonFile(file, messages);
};

const check = async (...args: string[]) => {
  const result = await runCli(['check', '--format', 'json', ...args], dir);
  return { ...result, report: JSON.parse(result.stdout) };
};

describe('ab-nextjs-i18n check', { timeout: 30_000 }, () => {
  it('passes on the starter messages (also with --strict)', async () => {
    const { code, report } = await check();
    expect(code).toBe(0);
    expect(report).toMatchObject({ ok: true, errors: 0, warnings: 0, sourceLocale: 'en', configOrigin: 'import' });
    expect((await check('--strict')).code).toBe(0);
    const text = await runCli(['check'], dir);
    expect(text.code).toBe(0);
    expect(text.stdout).toMatch(/0 error\(s\), 0 warning\(s\)/);
  });

  it('fails on a missing key', async () => {
    await edit('fr', (m) => delete m.App.title);
    const { code, report } = await check();
    expect(code).toBe(1);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'missing-key', locale: 'fr', key: 'App.title', severity: 'error' }));
  });

  it('fails on a placeholder mismatch (e.g. a translated {name})', async () => {
    await edit('fr', (m) => (m.App.greeting = 'Bonjour, {nom} !'));
    const { code, report } = await check();
    expect(code).toBe(1);
    const issue = report.issues.find((i: any) => i.code === 'placeholder-mismatch');
    expect(issue).toMatchObject({ locale: 'fr', key: 'App.greeting' });
    expect(issue.message).toMatch(/\{name\}/);
  });

  it('fails on a tag mismatch and on invalid ICU', async () => {
    await edit('es', (m) => (m.App.learnMore = 'Lee la documentación para añadir tus propios mensajes.'));
    await edit('ru', (m) => (m.App.items = '{count, plural, one {# элемент}'));
    const { code, report } = await check();
    expect(code).toBe(1);
    expect(report.issues.map((i: any) => `${i.locale}:${i.code}`)).toEqual(expect.arrayContaining(['es:placeholder-mismatch', 'ru:icu-syntax']));
  });

  it('only fails on warnings with --strict', async () => {
    await edit('fr', (m) => {
      m.App.extra = 'Pas dans la source';
      m.App.title = 'Welcome to abElements';
    });
    const lenient = await check();
    expect(lenient.code).toBe(0);
    expect(lenient.report.warnings).toBe(2);
    expect(lenient.report.issues.map((i: any) => i.code).sort()).toEqual(['extra-key', 'identical-to-source']);
    const strict = await check('--strict');
    expect(strict.code).toBe(1);
    expect(strict.report.ok).toBe(false);
  });

  it('warns when a plural lacks the locale\'s CLDR categories (ru one/few/many/other)', async () => {
    // A machine translation that kept the English branches only.
    await edit('ru', (m) => (m.App.items = '{count, plural, =0 {Пусто} one {# элемент} other {# элемента}}'));
    const { code, report } = await check();
    expect(code).toBe(0);
    expect(report.issues).toEqual([
      { severity: 'warning', code: 'plural-categories', locale: 'ru', key: 'App.items', message: '{count, plural} lacks ru categories few, many' },
    ]);
    expect((await check('--strict')).code).toBe(1);

    // Exact matches don't replace a category; ordinals use the ordinal rules (en: one, two, few, other).
    await edit('ru', (m) => (m.App.items = '{count, plural, =1 {# элемент} few {# элемента} many {# элементов} other {# элемента}}'));
    await edit('en', (m) => (m.App.rank = '{n, selectordinal, one {#st} other {#th}}'));
    for (const locale of ['fr', 'es', 'ru']) await edit(locale, (m) => (m.App.rank = '{n, selectordinal, other {#}}'));
    const second = await check();
    const plural = second.report.issues.filter((issue: any) => issue.code === 'plural-categories');
    expect(plural).toEqual([
      { severity: 'warning', code: 'plural-categories', locale: 'en', key: 'App.rank', message: '{n, selectordinal} lacks en categories two, few' },
      { severity: 'warning', code: 'plural-categories', locale: 'fr', key: 'App.rank', message: '{n, selectordinal} lacks fr category one' },
      { severity: 'warning', code: 'plural-categories', locale: 'ru', key: 'App.items', message: '{count, plural} lacks ru category one' },
    ]);
  });

  it('honours the glossary allowlist for identical values', async () => {
    await edit('fr', (m) => (m.App.title = 'Welcome to abElements'));
    await writeJsonFile(join(dir, 'messages', '.ab-i18n-glossary.json'), { doNotTranslate: ['abElements'], allowIdentical: ['App.title'] });
    expect((await check('--strict')).code).toBe(0);
  });

  it('reports empty translations and missing files', async () => {
    await edit('es', (m) => (m.App.title = ''));
    await removeDir(join(dir, 'messages', 'ru.json'));
    const { code, report } = await check();
    expect(code).toBe(1);
    expect(report.issues.map((i: any) => `${i.locale}:${i.code}`)).toEqual(expect.arrayContaining(['es:empty-value', 'ru:missing-file']));
  });
});
