import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTranslate as runTranslateJs } from '../cli/translate.mjs';
import deepl, { deeplTargetLang } from '../cli/providers/deepl.mjs';
import openai from '../cli/providers/openai.mjs';
import { resolveProviders } from '../cli/providers/index.mjs';
import { requestJson } from '../cli/lib/http.mjs';
import { readJsonFile, removeDir, runCli, writeJsonFile } from './helpers';

let dir: string;
const messages = (locale: string) => join(dir, 'messages', `${locale}.json`);
const silent = () => {};
// The CLI is plain JS; give the report a loose type for assertions.
const runTranslate = (options: Record<string, unknown>, io: Record<string, unknown>) =>
  runTranslateJs(options, io) as Promise<{ code: number; report: any }>;

/** A fake provider: prefixes every unit with `[to]`, records what it was asked. */
function mockProvider(name = 'mock', transform = (text: string, to: string) => `[${to}] ${text}`) {
  const calls: Array<{ texts: string[]; to: string }> = [];
  return {
    calls,
    provider: {
      name,
      batchSize: 4,
      async translate({ texts, to }: { texts: string[]; to: string }) {
        calls.push({ texts, to });
        return texts.map((text) => transform(text, to));
      },
    },
  };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ab-i18n-translate-'));
  await writeJsonFile(messages('en'), {
    App: { title: 'Welcome', greeting: 'Hello, {name}!', items: '{count, plural, one {# item} other {# items}}' },
    Common: { save: 'Save', brand: 'abElements', list: ['a', 'b'] },
  });
  await writeJsonFile(messages('fr'), { App: { title: 'Bienvenue' }, Common: { old: 'Ancien' } });
  await writeJsonFile(join(dir, 'messages', '.ab-i18n-glossary.json'), { doNotTranslate: ['abElements'] });
});
afterEach(async () => {
  await removeDir(dir);
});

describe('ab-nextjs-i18n translate', { timeout: 30_000 }, () => {
  it('fills only missing keys, in source order, keeping extra keys and hand-written ones', async () => {
    const { provider, calls } = mockProvider();
    const { code, report } = await runTranslate({ cwd: dir, to: 'fr' }, { providers: [provider], log: silent });
    expect(code).toBe(0);

    const fr = await readJsonFile(messages('fr'));
    expect(fr).toEqual({
      App: { title: 'Bienvenue', greeting: '[fr] Hello, {name}!', items: '{count, plural, one {[fr] # item} other {[fr] # items}}' },
      Common: { save: '[fr] Save', brand: 'abElements', list: ['a', 'b'], old: 'Ancien' },
    });
    expect(Object.keys(fr.Common)).toEqual(['save', 'brand', 'list', 'old']);
    // `title` existed (hand-written), `brand` is glossary-only (copied), the array is copied
    expect(calls.flatMap((call) => call.texts)).toEqual(['Hello, <ph id="0"/>!', '<ph id="0"/> item', '<ph id="0"/> items', 'Save']);
    expect(report.locales[0].copied).toEqual(['Common.list']);
    expect(report.locales[0].extra).toEqual(['Common.old']);

    const lock = await readJsonFile(join(dir, 'messages', '.ab-i18n-lock.json'));
    expect(lock.sourceLocale).toBe('en');
    expect(lock.locales.fr['App.title'].origin).toBe('human');
    expect(lock.locales.fr['App.greeting'].origin).toBe('mock');
    expect(JSON.stringify(lock)).not.toContain('Hello');
  });

  it('respects the lock: nothing to do on a second run, re-translates changed sources only', async () => {
    const first = mockProvider();
    await runTranslate({ cwd: dir, to: 'fr' }, { providers: [first.provider], log: silent });
    const snapshot = await readFile(messages('fr'), 'utf8');

    const second = mockProvider();
    await runTranslate({ cwd: dir, to: 'fr' }, { providers: [second.provider], log: silent });
    expect(second.calls).toHaveLength(0);
    expect(await readFile(messages('fr'), 'utf8')).toBe(snapshot);

    const en = await readJsonFile(messages('en'));
    en.Common.save = 'Save changes';
    await writeJsonFile(messages('en'), en);
    const third = mockProvider();
    const { report } = await runTranslate({ cwd: dir, to: 'fr' }, { providers: [third.provider], log: silent });
    expect(third.calls.flatMap((call) => call.texts)).toEqual(['Save changes']);
    expect(report.locales[0].translated).toEqual([{ key: 'Common.save', reason: 'source-changed', provider: 'mock' }]);
    expect((await readJsonFile(messages('fr'))).Common.save).toBe('[fr] Save changes');
  });

  it('never overwrites hand edits and reports them as stale when the source changes', async () => {
    await runTranslate({ cwd: dir, to: 'fr' }, { providers: [mockProvider().provider], log: silent });
    const fr = await readJsonFile(messages('fr'));
    fr.Common.save = 'Enregistrer';
    await writeJsonFile(messages('fr'), fr);
    const en = await readJsonFile(messages('en'));
    en.Common.save = 'Save now';
    en.App.title = 'Welcome!';
    await writeJsonFile(messages('en'), en);

    const { provider, calls } = mockProvider();
    const { report } = await runTranslate({ cwd: dir, to: 'fr', force: true }, { providers: [provider], log: silent });
    const after = await readJsonFile(messages('fr'));
    expect(after.Common.save).toBe('Enregistrer');
    expect(after.App.title).toBe('Bienvenue');
    expect(report.locales[0].stale.map((s: any) => s.key).sort()).toEqual(['App.title', 'Common.save']);
    // --force only re-translates machine-owned keys
    expect(calls.flatMap((call) => call.texts)).not.toContain('Save now');
    expect(calls.flatMap((call) => call.texts)).toContain('Hello, <ph id="0"/>!');
  });

  it('rejects outputs with mismatched placeholders and falls back to the next provider', async () => {
    const broken = mockProvider('broken', (text) => text.replace(/<ph id="\d+"\/>/g, '{oops}'));
    const { code, report } = await runTranslate({ cwd: dir, to: 'fr' }, { providers: [broken.provider], log: silent });
    expect(code).toBe(1);
    expect(report.locales[0].rejected.map((r: any) => r.key)).toEqual(['App.greeting', 'App.items']);
    expect(report.locales[0].rejected[0].error).toMatch(/exactly once/);
    const fr = await readJsonFile(messages('fr'));
    expect(fr.App.greeting).toBeUndefined();
    expect(fr.Common.save).toBe('Save'); // no placeholders, so the unit passes through

    await writeJsonFile(messages('fr'), { App: { title: 'Bienvenue' } });
    await removeDir(join(dir, 'messages', '.ab-i18n-lock.json'));
    const failing = { name: 'deepl-down', batchSize: 10, translate: async () => Promise.reject(new Error('HTTP 503')) };
    const backup = mockProvider('backup');
    const retry = await runTranslate({ cwd: dir, to: 'fr' }, { providers: [failing, broken.provider, backup.provider], log: silent });
    expect(retry.code).toBe(0);
    expect(retry.report.locales[0].translated.map((t: any) => t.provider)).toEqual(['backup', 'backup', 'broken', 'copy']);
  });

  it('creates a new locale file, honours --keys and --prune, and --dry-run writes nothing', async () => {
    const before = await readFile(messages('fr'), 'utf8');
    // no keys in env and no provider: a dry run still plans, but never calls or writes
    const dry = await runTranslate({ cwd: dir, 'dry-run': true }, { log: silent, env: {} });
    expect(dry.code).toBe(0);
    expect(dry.report.locales.map((l: any) => [l.locale, l.written])).toEqual([['fr', false]]);
    expect(dry.report.locales[0].planned).toHaveLength(4);
    expect(await readFile(messages('fr'), 'utf8')).toBe(before);

    const { provider } = mockProvider();
    await runTranslate({ cwd: dir, to: 'es', keys: 'App' }, { providers: [provider], log: silent });
    expect(await readJsonFile(messages('es'))).toEqual({
      App: { title: '[es] Welcome', greeting: '[es] Hello, {name}!', items: '{count, plural, one {[es] # item} other {[es] # items}}' },
    });

    await runTranslate({ cwd: dir, to: 'fr', prune: true }, { providers: [provider], log: silent });
    expect((await readJsonFile(messages('fr'))).Common.old).toBeUndefined();
  });

  it('works end to end through the bin with a custom provider file (no network, no keys)', async () => {
    await writeFile(
      join(dir, 'mock-provider.mjs'),
      "export default { name: 'file-mock', async translate({ texts, to }) { return texts.map((t) => `[${to}] ` + t); } };\n",
    );
    const dry = await runCli(['translate', '--dry-run', '--to', 'fr', '--report', 'json'], dir);
    expect(dry.code).toBe(0);
    expect(JSON.parse(dry.stdout).locales[0].planned.map((p: any) => p.key)).toEqual(['App.greeting', 'App.items', 'Common.save', 'Common.brand']);

    const noKeys = await runCli(['translate', '--to', 'fr'], dir);
    expect(noKeys.code).toBe(2);
    expect(noKeys.stdout).toMatch(/DEEPL_API_KEY or OPENAI_API_KEY/);

    const run = await runCli(['translate', '--to', 'fr', '--provider', './mock-provider.mjs', '--report', 'md'], dir);
    expect(run.code).toBe(0);
    expect(run.stdout).toMatch(/\| fr \| 4 \| 0 \| 0 \|/);
    const fr = await readJsonFile(messages('fr'));
    expect(fr.App.greeting).toBe('[fr] Hello, {name}!');
    expect(fr.Common.brand).toBe('abElements');
  });
});

describe('providers (mocked fetch, no network)', () => {
  const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

  it('DeepL: free host, XML tag handling, target codes and 429 backoff', async () => {
    const requests: Array<{ url: string; body: any; auth: string }> = [];
    const sleeps: number[] = [];
    let attempt = 0;
    const fetch = async (url: string, init: any) => {
      requests.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
      attempt++;
      if (attempt === 1) return jsonResponse(429, {}, { 'retry-after': '2' });
      return jsonResponse(200, { translations: [{ text: 'Bonjour <ph id="0"/>' }] });
    };
    const out = await deepl.translate({
      texts: ['Hello <ph id="0"/>'],
      from: 'en',
      to: 'fr',
      env: { DEEPL_API_KEY: 'secret:fx' },
      fetch,
      sleep: async (ms: number) => void sleeps.push(ms),
    } as any);
    expect(out).toEqual(['Bonjour <ph id="0"/>']);
    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe('https://api-free.deepl.com/v2/translate');
    expect(requests[0].body).toMatchObject({ source_lang: 'EN', target_lang: 'FR', tag_handling: 'xml', ignore_tags: ['ph'] });
    expect(sleeps).toEqual([2000]);
    expect(deeplTargetLang('en')).toBe('EN-US');
    expect(deeplTargetLang('pt-BR')).toBe('PT-BR');
  });

  it('OpenAI: model from AB_I18N_OPENAI_MODEL, JSON answer of the same length', async () => {
    let body: any;
    const fetch = async (_url: string, init: any) => {
      body = JSON.parse(init.body);
      return jsonResponse(200, { choices: [{ message: { content: JSON.stringify({ translations: ['Hola <ph id="0"/>'] }) } }] });
    };
    const out = await openai.translate({
      texts: ['Hello <ph id="0"/>'],
      from: 'en',
      to: 'es',
      glossary: { doNotTranslate: ['abElements'], terms: { es: { cart: 'carrito' } } },
      env: { OPENAI_API_KEY: 'sk-test', AB_I18N_OPENAI_MODEL: 'test-model' },
      fetch,
    } as any);
    expect(out).toEqual(['Hola <ph id="0"/>']);
    expect(body.model).toBe('test-model');
    expect(body.messages[0].content).toMatch(/"cart" → "carrito"/);
    expect(body.messages[0].content).toMatch(/Never translate: abElements/);
  });

  it('never leaks request headers (keys) in errors and gives up after the retries', async () => {
    const fetch = async () => jsonResponse(401, { message: 'bad key' });
    await expect(requestJson('https://api.example.com/x', { headers: { Authorization: 'secret' } }, { fetch, label: 'Example' })).rejects.toThrow(
      /^Example: HTTP 401/,
    );
    const always429 = async () => jsonResponse(429, {});
    await expect(requestJson('https://api.example.com/x', {}, { fetch: always429, sleep: async () => {}, retries: 2 })).rejects.toThrow(/after 3 attempts/);
  });

  it('chains DeepL then OpenAI by default and needs at least one key', async () => {
    await expect(resolveProviders(undefined, { cwd: dir, env: {} })).rejects.toThrow(/DEEPL_API_KEY or OPENAI_API_KEY/);
    expect((await resolveProviders(undefined, { cwd: dir, env: { DEEPL_API_KEY: 'k', OPENAI_API_KEY: 'k' } })).map((p: any) => p.name)).toEqual(['deepl', 'openai']);
    expect((await resolveProviders(undefined, { cwd: dir, env: { OPENAI_API_KEY: 'k' } })).map((p: any) => p.name)).toEqual(['openai']);
    await expect(resolveProviders('nope', { cwd: dir, env: {} })).rejects.toThrow(/Unknown provider/);
  });
});
