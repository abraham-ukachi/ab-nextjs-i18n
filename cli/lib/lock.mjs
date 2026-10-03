// ===== TRANSLATION LOCK ===== //
//
// `messages/.ab-i18n-lock.json` stores hashes only (never message text or keys
// to any service): for every target key, the hash of the source text it was
// last synced with, the hash of the target text, and who wrote it.

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { formatJson, readJson, writeFileAtomic } from './fs-safe.mjs';

export const LOCK_FILE = '.ab-i18n-lock.json';
export const LOCK_VERSION = 1;

/** Short, stable hash of a message. */
export function hashMessage(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

export const lockPath = (messagesDir) => join(messagesDir, LOCK_FILE);


/** Reads the lock (empty when missing). */
export async function readLock(messagesDir) {
  const lock = await readJson(lockPath(messagesDir), null);
  if (!lock) return { version: LOCK_VERSION, sourceLocale: undefined, locales: {} };
  if (lock.version !== LOCK_VERSION) throw new Error(`Unsupported ${LOCK_FILE} version ${lock.version}.`);
  return { version: LOCK_VERSION, sourceLocale: lock.sourceLocale, locales: lock.locales ?? {} };
}


/** Writes the lock with sorted locales and keys (stable diffs). */
export async function writeLock(messagesDir, lock) {
  const locales = {};
  for (const locale of Object.keys(lock.locales).sort()) {
    const entries = lock.locales[locale];
    locales[locale] = {};
    for (const key of Object.keys(entries).sort()) locales[locale][key] = entries[key];
  }
  await writeFileAtomic(lockPath(messagesDir), formatJson({ version: LOCK_VERSION, sourceLocale: lock.sourceLocale, locales }));
}


/**
 * Decides what to do with one existing target message.
 *
 * @param {{ sourceHash: string, target: string | undefined, entry?: { source: string, target: string, origin: string }, force?: boolean }} input
 * @returns {{ action: 'translate' | 'keep' | 'stale', reason: string, entry?: object }}
 */
export function classifyTarget({ sourceHash, target, entry, force = false }) {
  if (target === undefined || target === '') return { action: 'translate', reason: 'missing' };

  const targetHash = hashMessage(target);

  // Existing text the lock has never seen: written by a human (e.g. `init`'s starters).
  if (!entry) return { action: 'keep', reason: 'adopted', entry: { source: sourceHash, target: targetHash, origin: 'human' } };

  if (entry.origin !== 'human') {
    if (entry.target === targetHash) {
      if (entry.source !== sourceHash) return { action: 'translate', reason: 'source-changed' };
      if (force) return { action: 'translate', reason: 'forced' };
      return { action: 'keep', reason: 'up-to-date', entry };
    }
    // A machine translation that was edited by hand: it's the human's now.
    const humanEntry = { source: entry.source, target: targetHash, origin: 'human' };
    if (entry.source !== sourceHash) return { action: 'stale', reason: 'hand-edited, source changed', entry: humanEntry };
    return { action: 'keep', reason: 'hand-edited', entry: humanEntry };
  }

  // Human-owned. A new edit means the human has caught up with the source.
  if (entry.target !== targetHash) return { action: 'keep', reason: 'hand-edited', entry: { source: sourceHash, target: targetHash, origin: 'human' } };
  if (entry.source !== sourceHash) return { action: 'stale', reason: 'source changed since the human translation', entry };
  return { action: 'keep', reason: 'up-to-date', entry };
}
