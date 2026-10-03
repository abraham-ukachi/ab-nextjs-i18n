// ===== SAFE FILE SYSTEM HELPERS ===== //

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';


/** Returns `true` if `path` exists (file or folder). */
export async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}


/**
 * Writes `contents` to `path` atomically (temp file in the same folder + rename).
 *
 * @param { string } path
 * @param { string } contents
 */
export async function writeFileAtomic(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.${basename(path)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
  try {
    await writeFile(temp, contents, { encoding: 'utf8', flag: 'wx' });
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}


/**
 * Creates `path` only if it doesn't exist yet (`O_EXCL`), never overwriting.
 *
 * @param { string } path
 * @param { string } contents
 * @returns { Promise<boolean> } `true` when created, `false` when it already existed
 */
export async function writeFileIfMissing(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, contents, { encoding: 'utf8', flag: 'wx' });
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}


/** Reads and parses a JSON file (`fallback` when it doesn't exist). */
export async function readJson(path, fallback) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`);
  }
}


/** Formats JSON the Ab way: 2 spaces + trailing newline. */
export function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
