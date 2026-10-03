// ===== PROVIDERS ===== //
//
// A provider is an object (or a module whose default export is one, or a
// factory returning one):
//
//   export default {
//     name: 'my-provider',
//     batchSize: 25,                       // texts per call (optional, default 25)
//     isAvailable: (env) => true,          // optional
//     async translate({ texts, from, to, glossary, env, fetch, sleep }) {
//       // `texts` are XML-safe strings: keep every <ph id="N"/> and tags like <b>…</b>.
//       return texts.map(...);              // same length, same order
//     },
//   };
//
// Built-ins use `fetch` or `execFile`, never a shell. Keys only come from env vars.

import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import deepl from './deepl.mjs';
import google from './google.mjs';
import libretranslate from './libretranslate.mjs';
import openai from './openai.mjs';
import trans from './trans.mjs';

export const BUILT_IN_PROVIDERS = { deepl, openai, google, libretranslate, trans };

/** The default chain: DeepL first, OpenAI as the fallback. */
export const DEFAULT_CHAIN = ['deepl', 'openai'];

function validateProvider(provider, label) {
  if (!provider || typeof provider.translate !== 'function') {
    throw new Error(`Provider ${label} must export an object with a translate() function.`);
  }
  return { batchSize: 25, isAvailable: () => true, ...provider, name: provider.name ?? label };
}


/**
 * Resolves `--provider` into an ordered chain of providers.
 *
 * @param { string | undefined } spec - `deepl`, `openai`, `deepl,openai`, `./custom.mjs`...
 * @param {{ cwd: string, env: Record<string, string | undefined> }} context
 */
export async function resolveProviders(spec, { cwd, env }) {
  const names = spec ? spec.split(',').map((item) => item.trim()).filter(Boolean) : DEFAULT_CHAIN;
  const chain = [];

  for (const name of names) {
    if (BUILT_IN_PROVIDERS[name]) {
      chain.push(validateProvider(BUILT_IN_PROVIDERS[name], name));
      continue;
    }
    if (name.startsWith('.') || isAbsolute(name)) {
      const mod = await import(pathToFileURL(resolve(cwd, name)).href);
      const exported = mod.default ?? mod.provider ?? mod;
      chain.push(validateProvider(typeof exported === 'function' ? await exported({ env }) : exported, name));
      continue;
    }
    throw new Error(`Unknown provider "${name}". Use ${Object.keys(BUILT_IN_PROVIDERS).join(', ')} or a path like ./custom-provider.mjs.`);
  }

  const available = chain.filter((provider) => provider.isAvailable(env));
  if (available.length === 0) {
    const keys = chain.flatMap((provider) => provider.envKeys ?? []);
    throw new Error(
      `No translation provider is configured. Set ${keys.length ? keys.join(' or ') : 'the provider env vars'} (env vars only, never commit keys), or pass --provider.`,
    );
  }
  return available;
}
