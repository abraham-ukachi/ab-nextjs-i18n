import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from './helpers';

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

describe('ab-nextjs-i18n package smoke', () => {
  it('targets Next 16.3.4 peers and package metadata', () => {
    expect(pkg.name).toBe('ab-nextjs-i18n');
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.type).toBe('module');
    expect(pkg.peerDependencies.next).toBe('^16.3.4');
    // next-intl is a peer (the app owns the single instance), kept in devDependencies for tests
    expect(pkg.peerDependencies['next-intl']).toBe('^4.14.9');
    expect(pkg.devDependencies['next-intl']).toBe('^4.14.9');
    expect(pkg.dependencies['next-intl']).toBeUndefined();
    // icu-minify stays a direct dependency: the CLI imports it at runtime;
    // server-only guards `ab-nextjs-i18n/server` against client bundles
    expect(Object.keys(pkg.dependencies)).toEqual(['icu-minify', 'server-only']);
    expect(pkg.dependencies['icu-minify']).toBe('^4.14.9');
    expect(pkg.dependencies['server-only']).toBe('^0.0.1');
    expect(pkg.engines.node).toBe('>=22.18');
    expect(pkg.bin['ab-nextjs-i18n']).toBe('./bin/ab-nextjs-i18n.mjs');
  });

  it('marks the server entry and the cookie action as server-only', () => {
    for (const file of ['server/index.ts', 'server/ab-locale-cookie.ts']) {
      expect(readFileSync(join(root, file), 'utf8'), file).toMatch(/^import 'server-only';$/m);
    }
    // the client entry never pulls the server one in
    expect(readFileSync(join(root, 'index.ts'), 'utf8')).not.toMatch(/from '\.\/server/);
  });

  it('points every export at a file that is shipped', () => {
    const shipped = (file: string) => pkg.files.some((entry: string) => file === entry || file.startsWith(`${entry}/`));
    for (const [entry, target] of Object.entries<any>(pkg.exports)) {
      const files = typeof target === 'string' ? [target] : Object.values<string>(target);
      for (const file of files) {
        const clean = file.replace(/^\.\//, '');
        expect(existsSync(join(root, clean)), `${entry} → ${file}`).toBe(true);
        if (entry !== './package.json') expect(shipped(clean), `${clean} in files`).toBe(true);
      }
    }
  });

  it('keeps the bin, CLI and config/plugin entries in plain JS (loadable without type stripping)', async () => {
    const files = ['config.js', 'plugin.js', 'cli/init.mjs', 'cli/translate.mjs', 'cli/check.mjs', 'cli/migrate.mjs'];
    const urls = files.map((file) => pathToFileURL(join(root, file)).href);
    const script = `Promise.all(${JSON.stringify(urls)}.map((u) => import(u))).then(() => console.log('ok'))`;
    const output = await new Promise<string>((resolve, reject) => {
      execFile(process.execPath, ['--no-experimental-strip-types', '-e', script], (error, stdout, stderr) =>
        error ? reject(new Error(stderr)) : resolve(String(stdout)),
      );
    });
    expect(output.trim()).toBe('ok');
    expect(readFileSync(join(root, 'bin/ab-nextjs-i18n.mjs'), 'utf8').startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('exports the supportedApis catalog and every catalogued file exists', async () => {
    const mod = await import('../index');
    expect(mod.supportedApis.length).toBeGreaterThanOrEqual(20);
    expect(mod.supportedApis.every((api) => api.status === 'Done')).toBe(true);
    expect(mod.default.supportedApis).toBe(mod.supportedApis);
    for (const api of mod.supportedApis) expect(existsSync(join(root, api.file)), api.file).toBe(true);
    for (const name of ['useAbLocaleSwitch', 'useAbLocale', 'useAbTranslations', 'useAbFormatter', 'getAbLocaleLabel', 'AbI18nProvider']) {
      expect(typeof (mod as any)[name], name).toBe('function');
    }
  });

  it('ships tiny starter messages (4 examples) with the same keys in en, fr, es and ru', () => {
    const keys = (locale: string) => {
      const data = JSON.parse(readFileSync(join(root, 'templates/messages', `${locale}.json`), 'utf8'));
      return Object.entries<Record<string, string>>(data).flatMap(([ns, values]) => Object.keys(values).map((key) => `${ns}.${key}`));
    };
    const en = keys('en');
    // demo examples only: a plain string, an ICU placeholder, a plural and a rich-text tag
    expect(en).toEqual(['App.title', 'App.greeting', 'App.items', 'App.learnMore']);
    for (const locale of ['fr', 'es', 'ru']) expect(keys(locale)).toEqual(en);
  });
});
