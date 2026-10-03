import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const bin = join(root, 'bin', 'ab-nextjs-i18n.mjs');

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs the real bin with the current Node (no shell). */
export function runCli(args: string[], cwd: string, env: Record<string, string | undefined> = {}): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [bin, ...args],
      { cwd, env: { ...process.env, NO_COLOR: '1', DEEPL_API_KEY: '', OPENAI_API_KEY: '', ...env } },
      (error, stdout, stderr) => {
        const code = error ? (typeof (error as any).code === 'number' ? (error as any).code : 1) : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

/** Creates a fake Next.js app (package.json + app/) that resolves `ab-nextjs-i18n` to this repo. */
export async function makeTempApp(options: { src?: boolean; files?: Record<string, string> } = {}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ab-i18n-'));
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'fake-app', private: true, dependencies: { next: '16.3.4' } }, null, 2));
  await mkdir(join(dir, options.src ? 'src/app' : 'app'), { recursive: true });
  await mkdir(join(dir, 'node_modules'), { recursive: true });
  await symlink(root, join(dir, 'node_modules', 'ab-nextjs-i18n'), 'dir');
  for (const [file, contents] of Object.entries(options.files ?? {})) {
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await writeFile(join(dir, file), contents);
  }
  return dir;
}

export const removeDir = (dir: string): Promise<void> => rm(dir, { recursive: true, force: true });

/** Snapshot of every file (path → contents), ignoring node_modules. */
export async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = async (current: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else out[relative(dir, path)] = await readFile(path, 'utf8');
    }
  };
  await walk(dir);
  return out;
}

export async function readJsonFile(path: string): Promise<any> {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
