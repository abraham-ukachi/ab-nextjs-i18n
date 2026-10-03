// ===== MESSAGES HELPERS ===== //

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);


/**
 * Flattens nested messages into ordered `[key, value]` pairs (`App.title`).
 * Arrays, numbers and booleans are leaves (never translated).
 *
 * @param { object } messages
 * @returns { Array<[string, unknown]> }
 */
export function flattenMessages(messages, prefix = '', out = []) {
  for (const [key, value] of Object.entries(messages ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) flattenMessages(value, path, out);
    else out.push([path, value]);
  }
  return out;
}


/** Returns the keys (dotted) of every nested object, e.g. `App`, `App.nav`. */
export function collectNamespaces(messages, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(messages ?? {})) {
    if (isPlainObject(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      out.add(path);
      collectNamespaces(value, path, out);
    }
  }
  return out;
}


/**
 * Rebuilds nested messages from ordered `[key, value]` pairs.
 *
 * @param { Iterable<[string, unknown]> } entries
 * @returns { object }
 */
export function unflattenMessages(entries) {
  const root = {};
  for (const [key, value] of entries) {
    const parts = key.split('.');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!isPlainObject(node[part])) node[part] = {};
      node = node[part];
    }
    node[parts[parts.length - 1]] = value;
  }
  return root;
}


/**
 * Orders `target` like `source` (source key order first, extra target keys after,
 * unless `prune`).
 *
 * @param { Array<[string, unknown]> } sourceEntries
 * @param { Map<string, unknown> } targetMap
 * @param { { prune?: boolean } } [options]
 * @returns {{ entries: Array<[string, unknown]>, extra: string[] }}
 */
export function orderLikeSource(sourceEntries, targetMap, options = {}) {
  const entries = [];
  const sourceKeys = new Set();
  for (const [key] of sourceEntries) {
    sourceKeys.add(key);
    if (targetMap.has(key)) entries.push([key, targetMap.get(key)]);
  }
  const extra = [...targetMap.keys()].filter((key) => !sourceKeys.has(key));
  if (!options.prune) for (const key of extra) entries.push([key, targetMap.get(key)]);
  return { entries, extra };
}


/**
 * Matches a dotted key against `--keys` patterns: exact key, a namespace prefix
 * (`App` → `App.*`), `*` (one segment) and `**` (any depth).
 *
 * @param { string } key
 * @param { string[] | undefined } patterns
 * @returns { boolean }
 */
export function matchesKeyPatterns(key, patterns) {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((pattern) => {
    if (key === pattern || key.startsWith(`${pattern}.`)) return true;
    const regex = new RegExp(
      `^${pattern
        .split('**')
        .map((part) => part.split('*').map((chunk) => chunk.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^.]*'))
        .join('.*')}$`,
    );
    return regex.test(key);
  });
}


/** Lists `<locale>.json` files in a messages folder (dotfiles excluded). */
export async function listMessageLocales(dir) {
  try {
    const names = await readdir(dir);
    return names
      .filter((name) => name.endsWith('.json') && !name.startsWith('.'))
      .map((name) => name.slice(0, -'.json'.length))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export const messagesFile = (dir, locale) => join(dir, `${locale}.json`);


/** Maps every leaf of nested messages, keeping the exact structure (incl. empty objects). */
export function mapMessages(messages, fn, prefix = '') {
  const out = Array.isArray(messages) ? [] : {};
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out[key] = isPlainObject(value) ? mapMessages(value, fn, path) : fn(path, value);
  }
  return out;
}
