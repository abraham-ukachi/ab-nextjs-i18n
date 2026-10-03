// ===== REDACT SECRETS ===== //
//
// Provider error bodies can echo the API key back ("invalid key sk-…"). Every error
// message the CLI prints or writes to a report goes through `redactSecrets`.

/** Env vars that hold API keys for the built-in providers. */
export const SECRET_ENV_KEYS = ['DEEPL_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_TRANSLATE_API_KEY', 'LIBRETRANSLATE_API_KEY'];

/** Env vars the CLI reads that are not secrets (kept readable in errors). */
export const NON_SECRET_ENV_KEYS = new Set(['AB_I18N_OPENAI_MODEL']);

export const REDACTED = '[redacted]';

// OpenAI-style keys (`sk-…`, `sk-proj-…`) and DeepL free keys (`…:fx`), even when not configured here.
const KEY_PATTERNS = [/(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]+/g, /(?<![A-Za-z0-9-])[A-Za-z0-9-]+:fx(?![A-Za-z0-9])/g];


/**
 * Replaces every secret value (and anything that looks like an OpenAI / DeepL free key)
 * with `[redacted]`.
 *
 * @param { unknown } text
 * @param { Iterable<string | undefined | null> } [secrets] - exact values to hide (values shorter than 4 chars are ignored)
 * @returns { string }
 */
export function redactSecrets(text, secrets = []) {
  let out = String(text);
  const values = [...new Set([...secrets].filter((value) => typeof value === 'string' && value.length >= 4))];
  for (const value of values.sort((a, b) => b.length - a.length)) out = out.split(value).join(REDACTED);
  for (const pattern of KEY_PATTERNS) out = out.replace(pattern, REDACTED);
  return out;
}


/**
 * The values of the env vars in `keys` that should never be shown (skips non-secrets).
 *
 * @param { Record<string, string | undefined> } env
 * @param { Iterable<string> } keys
 * @returns { string[] }
 */
export function secretEnvValues(env, keys) {
  return [...new Set(keys)].filter((key) => !NON_SECRET_ENV_KEYS.has(key)).map((key) => env[key]).filter(Boolean);
}


/** Secrets sent with a request: auth headers (and the value after `Bearer ` etc.) and JSON `api_key` / `auth_key`. */
export function requestSecrets(init = {}) {
  const secrets = [];
  for (const [name, value] of Object.entries(init.headers ?? {})) {
    if (!/auth|key|token/i.test(name) || typeof value !== 'string') continue;
    secrets.push(value);
    const space = value.indexOf(' ');
    if (space > 0) secrets.push(value.slice(space + 1));
  }
  if (typeof init.body === 'string' && init.body.startsWith('{')) {
    try {
      const body = JSON.parse(init.body);
      for (const field of ['api_key', 'auth_key', 'key']) if (typeof body[field] === 'string') secrets.push(body[field]);
    } catch {
      // not JSON
    }
  }
  return secrets;
}
