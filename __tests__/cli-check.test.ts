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
    await edit('fr', (m) => delete m.Common.save);
    const { code, report } = await check();
    expect(code).toBe(1);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'missing-key', locale: 'fr', key: 'Common.save', severity: 'error' }));
  });

  it('fails on a placeholder mismatch (e.g. a translated {language})', async () => {
    await edit('fr', (m) => (m.Language.changed = 'La langue a été changée en {langue}.'));
    const { code, report } = await check();
    expect(code).toBe(1);
    const issue = report.issues.find((i: any) => i.code === 'placeholder-mismatch');
    expect(issue).toMatchObject({ locale: 'fr', key: 'Language.changed' });
    expect(issue.message).toMatch(/\{language\}/);
  });

  it('fails on a tag mismatch and on invalid ICU', async () => {
    await edit('es', (m) => (m.Common.learnMore = 'Más información sobre {name}'));
    await edit('ru', (m) => (m.Common.items = '{count, plural, one {# элемент}'));
    const { code, report } = await check();
    expect(code).toBe(1);
    expect(report.issues.map((i: any) => `${i.locale}:${i.code}`)).toEqual(expect.arrayContaining(['es:placeholder-mismatch', 'ru:icu-syntax']));
  });

  it('only fails on warnings with --strict', async () => {
    await edit('fr', (m) => {
      m.Common.extra = 'Pas dans la source';
      m.Theme.label = 'Theme';
    });
    const lenient = await check();
    expect(lenient.code).toBe(0);
    expect(lenient.report.warnings).toBe(2);
    expect(lenient.report.issues.map((i: any) => i.code).sort()).toEqual(['extra-key', 'identical-to-source']);
    const strict = await check('--strict');
    expect(strict.code).toBe(1);
    expect(strict.report.ok).toBe(false);
  });

  it('honours the glossary allowlist for identical values', async () => {
    await edit('fr', (m) => (m.Theme.label = 'Theme'));
    await writeJsonFile(join(dir, 'messages', '.ab-i18n-glossary.json'), { doNotTranslate: ['abElements'], allowIdentical: ['Theme.label'] });
    expect((await check('--strict')).code).toBe(0);
  });

  it('reports empty translations and missing files', async () => {
    await edit('es', (m) => (m.Common.save = ''));
    await removeDir(join(dir, 'messages', 'ru.json'));
    const { code, report } = await check();
    expect(code).toBe(1);
    expect(report.issues.map((i: any) => `${i.locale}:${i.code}`)).toEqual(expect.arrayContaining(['es:empty-value', 'ru:missing-file']));
  });
});
