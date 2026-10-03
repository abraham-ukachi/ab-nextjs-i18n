// ===== GLOSSARY ===== //
//
// `messages/.ab-i18n-glossary.json`:
// {
//   "doNotTranslate": ["abElements", "Next.js"],   // masked before translation, allowed to stay identical
//   "allowIdentical": ["App.title"],               // keys `check` won't warn about when identical to the source
//   "terms": { "fr": { "cart": "panier" } }        // preferred translations (sent to LLM providers)
// }

import { join } from 'node:path';
import { readJson } from './fs-safe.mjs';

export const GLOSSARY_FILE = '.ab-i18n-glossary.json';

export async function readGlossary(messagesDir) {
  const raw = await readJson(join(messagesDir, GLOSSARY_FILE), {});
  return {
    doNotTranslate: Array.isArray(raw.doNotTranslate) ? raw.doNotTranslate.filter((t) => typeof t === 'string' && t) : [],
    allowIdentical: Array.isArray(raw.allowIdentical) ? raw.allowIdentical.filter((t) => typeof t === 'string') : [],
    terms: raw.terms && typeof raw.terms === 'object' ? raw.terms : {},
  };
}

/** Returns `true` when `value` has nothing left to translate once glossary terms and placeholders are removed. */
export function isGlossaryOnly(value, glossary) {
  let rest = String(value).replace(/\{[^{}]*\}/g, ' ').replace(/<\/?[A-Za-z][\w.-]*\s*>/g, ' ');
  for (const term of [...glossary.doNotTranslate].sort((a, b) => b.length - a.length)) rest = rest.split(term).join(' ');
  return !/\p{L}/u.test(rest);
}
