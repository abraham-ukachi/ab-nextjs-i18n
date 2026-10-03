import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeTempApp, removeDir, runCli, snapshot } from './helpers';

const EXPECTED = [
  'messages/en.json',
  'messages/fr.json',
  'messages/es.json',
  'messages/ru.json',
  'messages/.ab-i18n-glossary.json',
  'i18n/config.ts',
  'i18n/request.ts',
  'i18n/navigation.ts',
  'i18n/global.d.ts',
  'proxy.ts',
];

const dirs: string[] = [];
const app = async (options?: Parameters<typeof makeTempApp>[0]) => {
  const dir = await makeTempApp(options);
  dirs.push(dir);
  return dir;
};
afterEach(async () => {
  await Promise.all(dirs.splice(0).map(removeDir));
});

describe('ab-nextjs-i18n init', { timeout: 30_000 }, () => {
  it('creates the expected files in a fake Next app', async () => {
    const dir = await app();
    const { code, stdout } = await runCli(['init', '--json'], dir);
    expect(code).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.files.map((f: any) => [f.path, f.status])).toEqual(EXPECTED.map((path) => [path, 'created']));
    for (const file of EXPECTED) expect(existsSync(join(dir, file)), file).toBe(true);

    const config = readFileSync(join(dir, 'i18n/config.ts'), 'utf8');
    expect(config).toContain("locales: ['en', 'fr', 'es', 'ru']");
    expect(config).toContain("localePrefix: 'as-needed'");
    expect(readFileSync(join(dir, 'i18n/global.d.ts'), 'utf8')).toContain('interface AppConfig');
    expect(readFileSync(join(dir, 'i18n/request.ts'), 'utf8')).toContain('import(`../messages/${locale}.json`)');
    expect(readFileSync(join(dir, 'proxy.ts'), 'utf8')).toContain("matcher: '/((?!api|trpc|_next|_vercel|.*\\\\..*).*)'");
    expect(report.nextSteps.join('\n')).toMatch(/withAbI18n/);
    // init never touches package.json / next.config / tsconfig
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).dependencies).toEqual({ next: '16.3.4' });
    expect(existsSync(join(dir, 'next.config.ts'))).toBe(false);
  });

  it('tells the app to install ab-nextjs-i18n and its next-intl peer with the detected package manager', async () => {
    const pnpmApp = await app({ files: { 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" } });
    const pnpmSteps = JSON.parse((await runCli(['init', '--json', '--dry-run'], pnpmApp)).stdout).nextSteps.join('\n');
    expect(pnpmSteps).toContain('pnpm add ab-nextjs-i18n next-intl');
    expect(pnpmSteps).toContain('next-intl ^4.14.9 is a peer dependency');

    const npmApp = await app({ files: { 'package-lock.json': '{}\n' } });
    const npmSteps = JSON.parse((await runCli(['init', '--json', '--dry-run'], npmApp)).stdout).nextSteps.join('\n');
    expect(npmSteps).toContain('npm i ab-nextjs-i18n next-intl');

    // already installed: nothing to add for next-intl, only the missing package
    const withPeer = await app({ files: { 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" } });
    const pkgPath = join(withPeer, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    writeFileSync(pkgPath, JSON.stringify({ ...pkg, dependencies: { ...pkg.dependencies, 'next-intl': '^4.14.9' } }));
    const peerSteps = JSON.parse((await runCli(['init', '--json', '--dry-run'], withPeer)).stdout).nextSteps.join('\n');
    expect(peerSteps).toContain('pnpm add ab-nextjs-i18n\n');
    expect(peerSteps).not.toMatch(/add[^\n]*next-intl/);
  });

  it('changes nothing when run twice (byte-identical, everything skipped)', async () => {
    const dir = await app();
    expect((await runCli(['init'], dir)).code).toBe(0);
    const before = await snapshot(dir);
    const { code, stdout } = await runCli(['init', '--json'], dir);
    expect(code).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.files.every((f: any) => f.status === 'skipped')).toBe(true);
    expect(await snapshot(dir)).toEqual(before);
  });

  it('never overwrites an existing file', async () => {
    const dir = await app({ files: { 'messages/en.json': '{"Mine":{"keep":"me"}}\n', 'i18n/config.ts': '// mine\n' } });
    const { stdout } = await runCli(['init', '--json'], dir);
    const report = JSON.parse(stdout);
    expect(report.files.find((f: any) => f.path === 'messages/en.json').status).toBe('skipped');
    expect(readFileSync(join(dir, 'messages/en.json'), 'utf8')).toBe('{"Mine":{"keep":"me"}}\n');
    expect(readFileSync(join(dir, 'i18n/config.ts'), 'utf8')).toBe('// mine\n');
  });

  it('does not write proxy.ts when middleware.ts exists (prints the codemod)', async () => {
    const dir = await app({ files: { 'middleware.ts': 'export default function middleware() {}\n' } });
    const { code, stdout } = await runCli(['init', '--json'], dir);
    expect(code).toBe(0);
    const report = JSON.parse(stdout);
    expect(existsSync(join(dir, 'proxy.ts'))).toBe(false);
    expect(report.files.find((f: any) => f.path === 'proxy.ts')).toMatchObject({ status: 'skipped', reason: 'middleware.ts exists' });
    expect(report.nextSteps.join('\n')).toMatch(/middleware-to-proxy/);
  });

  it('keeps an existing proxy.ts and prints a merge snippet', async () => {
    const dir = await app({ files: { 'proxy.ts': '// auth proxy\n' } });
    const { stdout } = await runCli(['init'], dir);
    expect(readFileSync(join(dir, 'proxy.ts'), 'utf8')).toBe('// auth proxy\n');
    expect(stdout).toMatch(/createAbI18nProxy\(abI18nConfig, \{ onRequest/);
  });

  it('writes nothing with --dry-run', async () => {
    const dir = await app();
    const before = await snapshot(dir);
    const { code, stdout } = await runCli(['init', '--dry-run', '--json'], dir);
    expect(code).toBe(0);
    expect(JSON.parse(stdout).files.every((f: any) => f.status === 'would-create')).toBe(true);
    expect(await snapshot(dir)).toEqual(before);
  });

  it('supports src/, custom locales, prefix and messages dir', async () => {
    const dir = await app({ src: true });
    const { code } = await runCli(['init', '--locales', 'en,de', '--default', 'de', '--prefix', 'always', '--dir', 'locales'], dir);
    expect(code).toBe(0);
    expect(existsSync(join(dir, 'src/i18n/config.ts'))).toBe(true);
    expect(existsSync(join(dir, 'src/proxy.ts'))).toBe(true);
    expect(readFileSync(join(dir, 'src/i18n/request.ts'), 'utf8')).toContain('import(`../../locales/${locale}.json`)');
    expect(readFileSync(join(dir, 'src/i18n/config.ts'), 'utf8')).toContain("defaultLocale: 'de'");
    // the unknown source locale gets the English starters; other unknown locales start empty
    expect(Object.keys(JSON.parse(readFileSync(join(dir, 'locales/de.json'), 'utf8')))).toContain('App');
    expect(JSON.parse(readFileSync(join(dir, 'locales/en.json'), 'utf8')).App.name).toBe('abElements');
  });

  it('rejects bad flags and refuses to run outside a Next app without --yes', async () => {
    const dir = await app();
    expect((await runCli(['init', '--prefix', 'domains'], dir)).code).toBe(2);
    expect((await runCli(['init', '--locales', 'en,EN'], dir)).code).toBe(2);
    expect((await runCli(['init', '--default', 'de'], dir)).code).toBe(2);
    expect((await runCli(['init', '--force'], dir)).code).toBe(2);
    const empty = await app();
    await removeDir(join(empty, 'package.json'));
    expect((await runCli(['init'], empty)).code).toBe(2);
    expect((await runCli(['init', '--yes', '--dry-run'], empty)).code).toBe(0);
  });
});
