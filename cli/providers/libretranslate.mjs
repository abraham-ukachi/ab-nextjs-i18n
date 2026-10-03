// ===== LibreTranslate provider ===== //
// Env: LIBRETRANSLATE_URL (e.g. http://localhost:5000), optional LIBRETRANSLATE_API_KEY.
// Opt-in with `--provider libretranslate`.

import { requestJson } from '../lib/http.mjs';

const libreTranslateProvider = {
  name: 'libretranslate',
  batchSize: 25,
  envKeys: ['LIBRETRANSLATE_URL'],
  isAvailable: (env) => Boolean(env.LIBRETRANSLATE_URL),

  async translate({ texts, from, to, env, fetch, sleep }) {
    const base = env.LIBRETRANSLATE_URL.replace(/\/+$/, '');
    const data = await requestJson(
      `${base}/translate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: texts,
          source: from.split('-')[0],
          target: to.split('-')[0],
          format: 'html',
          ...(env.LIBRETRANSLATE_API_KEY ? { api_key: env.LIBRETRANSLATE_API_KEY } : {}),
        }),
      },
      { fetch, sleep, label: 'LibreTranslate' },
    );
    const result = data.translatedText;
    return Array.isArray(result) ? result : [result];
  },
};

export default libreTranslateProvider;
