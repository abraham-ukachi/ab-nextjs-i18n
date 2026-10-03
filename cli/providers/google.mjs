// ===== Google Cloud Translation (v2) provider ===== //
// Env: GOOGLE_TRANSLATE_API_KEY. Opt-in with `--provider google`.

import { requestJson } from '../lib/http.mjs';

const googleProvider = {
  name: 'google',
  batchSize: 100,
  envKeys: ['GOOGLE_TRANSLATE_API_KEY'],
  isAvailable: (env) => Boolean(env.GOOGLE_TRANSLATE_API_KEY),

  async translate({ texts, from, to, env, fetch, sleep }) {
    const data = await requestJson(
      'https://translation.googleapis.com/language/translate/v2',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_TRANSLATE_API_KEY },
        body: JSON.stringify({ q: texts, source: from, target: to, format: 'html' }),
      },
      { fetch, sleep, label: 'Google Translate' },
    );
    return (data.data?.translations ?? []).map((item) => item.translatedText);
  },
};

export default googleProvider;
