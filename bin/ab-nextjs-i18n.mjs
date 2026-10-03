#!/usr/bin/env node
// ===== ab-nextjs-i18n CLI ===== //
//
//   npx ab-nextjs-i18n init | translate | check | migrate [options]

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

// Quietly stop when piped into `head` & co.
process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(process.exitCode ?? 0);
  throw error;
});

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  process.stderr.write(`ab-nextjs-i18n needs Node.js >= 22.18 (built-in TypeScript stripping to read i18n/config.ts). You have ${process.versions.node}.\n`);
  process.exit(2);
}

const HELP = `
ab-nextjs-i18n ${pkg.version} - i18n for Ab Next.js apps (next-intl + CLI)

Usage: ab-nextjs-i18n <command> [options]

Commands:
  init        Add i18n to a Next.js app (only creates missing files)
  translate   Fill missing translations (DeepL, OpenAI fallback)
  check       Validate messages for CI (exit 1 on errors)
  migrate     Rewrite LYD (x) placeholders to ICU {x}

Run "ab-nextjs-i18n <command> --help" for the options of a command.
`;

// Every flag of every command (each command ignores the ones it doesn't use).
const OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  cwd: { type: 'string' },
  dir: { type: 'string' },
  json: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  // init
  locales: { type: 'string' },
  default: { type: 'string' },
  prefix: { type: 'string' },
  src: { type: 'boolean' },
  yes: { type: 'boolean', short: 'y' },
  // translate
  from: { type: 'string' },
  to: { type: 'string' },
  provider: { type: 'string' },
  keys: { type: 'string' },
  force: { type: 'boolean' },
  prune: { type: 'boolean' },
  concurrency: { type: 'string' },
  report: { type: 'string' },
  // check
  source: { type: 'string' },
  strict: { type: 'boolean' },
  format: { type: 'string' },
  // migrate
  write: { type: 'boolean' },
  names: { type: 'string' },
  ignore: { type: 'string' },
};

// Flags each command accepts (anything else is an error, e.g. `init --force`).
const COMMON = ['help', 'version', 'cwd'];
const COMMAND_FLAGS = {
  init: [...COMMON, 'locales', 'default', 'dir', 'prefix', 'src', 'dry-run', 'json', 'yes'],
  translate: [...COMMON, 'dir', 'from', 'to', 'provider', 'keys', 'force', 'prune', 'concurrency', 'dry-run', 'report'],
  check: [...COMMON, 'dir', 'locales', 'source', 'strict', 'format'],
  migrate: [...COMMON, 'dir', 'write', 'names', 'ignore', 'json'],
};

const COMMANDS = {
  init: async () => {
    const mod = await import('../cli/init.mjs');
    return { run: mod.runInit, help: mod.INIT_HELP };
  },
  translate: async () => {
    const mod = await import('../cli/translate.mjs');
    return { run: mod.runTranslate, help: mod.TRANSLATE_HELP };
  },
  check: async () => {
    const mod = await import('../cli/check.mjs');
    return { run: mod.runCheck, help: mod.CHECK_HELP };
  },
  migrate: async () => {
    const mod = await import('../cli/migrate.mjs');
    return { run: mod.runMigrate, help: mod.MIGRATE_HELP };
  },
};

async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, allowNegative: true, strict: true });
  } catch (error) {
    process.stderr.write(`✖ ${error.message}\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;

  if (values.version) {
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  if (!command) {
    process.stdout.write(HELP);
    return values.help ? 0 : 2;
  }
  if (!COMMANDS[command]) {
    process.stderr.write(`✖ Unknown command "${command}".\n${HELP}`);
    return 2;
  }
  if (rest.length) {
    process.stderr.write(`✖ Unexpected argument(s): ${rest.join(' ')}\n`);
    return 2;
  }

  const unknown = Object.keys(values).filter((flag) => !COMMAND_FLAGS[command].includes(flag));
  if (unknown.length) {
    process.stderr.write(`✖ ${command} doesn't accept ${unknown.map((flag) => `--${flag}`).join(', ')}. See "ab-nextjs-i18n ${command} --help".\n`);
    return 2;
  }

  const { run, help } = await COMMANDS[command]();
  if (values.help) {
    process.stdout.write(help);
    return 0;
  }
  const { code } = await run(values);
  return code;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`✖ ${error?.message ?? error}\n`);
    process.exitCode = 1;
  },
);
