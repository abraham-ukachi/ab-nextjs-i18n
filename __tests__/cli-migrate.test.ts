import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateMessage } from '../cli/migrate.mjs';
import { removeDir, runCli, writeJsonFile } from './helpers';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ab-i18n-migrate-'));
  await writeJsonFile(join(dir, 'messages/en.json'), {
    Menu: {
      languageChanged: 'Language changed to (m)',
      count: '(x) of (y) items',
      optional: 'Phone (optional)',
      items: 'Remove item(s)',
      user: 'Hello (name)',
    },
  });
  await writeJsonFile(join(dir, 'messages/fr.json'), {
    Menu: {
      languageChanged: 'Langue changée en (m)',
      count: '(x) sur (y) articles',
      optional: 'Téléphone (facultatif)',
      items: 'Supprimer le(s) article(s)',
      user: 'Bonjour (name)',
    },
  });
});
afterEach(async () => {
  await removeDir(dir);
});

describe('ab-nextjs-i18n migrate', { timeout: 30_000 }, () => {
  it('only reports in dry-run mode (default) and rewrites with --write', async () => {
    const before = await readFile(join(dir, 'messages/en.json'), 'utf8');
    const dry = await runCli(['migrate', '--json'], dir);
    expect(dry.code).toBe(0);
    const report = JSON.parse(dry.stdout);
    expect(report.write).toBe(false);
    expect(report.changes.map((c: any) => `${c.locale}:${c.key}`)).toEqual([
      'en:Menu.languageChanged',
      'en:Menu.count',
      'en:Menu.user',
      'fr:Menu.languageChanged',
      'fr:Menu.count',
      'fr:Menu.user',
    ]);
    expect(await readFile(join(dir, 'messages/en.json'), 'utf8')).toBe(before);

    const wet = await runCli(['migrate', '--write'], dir);
    expect(wet.code).toBe(0);
    const en = JSON.parse(await readFile(join(dir, 'messages/en.json'), 'utf8'));
    expect(en.Menu).toEqual({
      languageChanged: 'Language changed to {m}',
      count: '{x} of {y} items',
      optional: 'Phone (optional)',
      items: 'Remove item(s)',
      user: 'Hello {name}',
    });
    expect((await runCli(['check', '--format', 'json'], dir)).code).toBe(0);
  });

  it('avoids false positives', () => {
    expect(migrateMessage('Add item(s)').result).toBe('Add item(s)');
    expect(migrateMessage('(s)he left').result).toBe('(s)he left');
    expect(migrateMessage('(a) Sign in (b) Pay').result).toBe('(a) Sign in (b) Pay');
    expect(migrateMessage('Phone (optional)').skipped[0].reason).toMatch(/ambiguous/);
    expect(migrateMessage('Phone (optional)', { otherValues: ['Téléphone (facultatif)'] }).result).toBe('Phone (optional)');
    expect(migrateMessage('Hi (name)', { otherValues: ['Salut (name)'] }).result).toBe('Hi {name}');
    expect(migrateMessage('Hi (name)', { names: ['name'] }).result).toBe('Hi {name}');
    expect(migrateMessage('Search (x) (beta)', { otherValues: ['Recherche (x) (beta)'], ignore: ['beta'] }).result).toBe('Search {x} (beta)');
    expect(migrateMessage('{oops (x)').result).toBe('{oops (x)');
  });
});
