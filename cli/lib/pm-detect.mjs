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

export function addCommand(manager, pkgName) {
  return { pnpm: `pnpm add ${pkgName}`, yarn: `yarn add ${pkgName}`, bun: `bun add ${pkgName}`, npm: `npm i ${pkgName}` }[manager];
}

export function execCommand(manager, bin) {
  return { pnpm: `pnpm exec ${bin}`, yarn: `yarn ${bin}`, bun: `bunx ${bin}`, npm: `npx ${bin}` }[manager];
}
