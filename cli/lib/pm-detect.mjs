// ===== PACKAGE MANAGER DETECTION ===== //

import { join } from 'node:path';
import { exists } from './fs-safe.mjs';

const LOCKFILES = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
];


/**
 * Detects the package manager: `packageManager` field → lockfile → user agent → npm.
 *
 * @param { string } root
 * @param { object | null } pkg - the app's package.json
 * @param { string } [userAgent]
 * @returns { Promise<'pnpm' | 'yarn' | 'bun' | 'npm'> }
 */
export async function detectPackageManager(root, pkg, userAgent = process.env.npm_config_user_agent ?? '') {
  const field = typeof pkg?.packageManager === 'string' ? pkg.packageManager.split('@')[0] : '';
  if (['pnpm', 'yarn', 'bun', 'npm'].includes(field)) return field;
  for (const [file, manager] of LOCKFILES) if (await exists(join(root, file))) return manager;
  const agent = userAgent.split('/')[0];
  if (['pnpm', 'yarn', 'bun', 'npm'].includes(agent)) return agent;
  return 'npm';
}

/** `pnpm add a b`, `npm i a b`... (`pkgNames` is a name or a list of names). */
export function addCommand(manager, pkgNames) {
  const names = [pkgNames].flat().join(' ');
  return { pnpm: `pnpm add ${names}`, yarn: `yarn add ${names}`, bun: `bun add ${names}`, npm: `npm i ${names}` }[manager];
}

export function execCommand(manager, bin) {
  return { pnpm: `pnpm exec ${bin}`, yarn: `yarn ${bin}`, bun: `bunx ${bin}`, npm: `npx ${bin}` }[manager];
}
