// ===== DeepL provider ===== //
// Env: DEEPL_API_KEY (keys ending in `:fx` use the free API host).

import { requestJson } from '../lib/http.mjs';

const sourceLang = (locale) => locale.split('-')[0].toUpperCase();

/** DeepL target codes: `en` → `EN-US`, `pt` → `PT-PT`, `zh` → `ZH-HANS`, `pt-BR` → `PT-BR`. */
export function deeplTargetLang(locale) {
  const [lang, region] = locale.split('-');
  if (region) return `${lang}-${region}`.toUpperCase();
  return { en: 'EN-US', pt: 'PT-PT', zh: 'ZH-HANS' }[lang] ?? lang.toUpperCase();
}

const deeplProvider = {
  name: 'deepl',
  batchSize: 50,
  envKeys: ['DEEPL_API_KEY'],
  isAvailable: (env) => Boolean(env.DEEPL_API_KEY),

  async translate({ texts, from, to, env, fetch, sleep }) {
    const key = env.DEEPL_API_KEY;
    const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const data = await requestJson(
      `${host}/v2/translate`,
      {
        method: 'POST',
        headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: texts,
          source_lang: sourceLang(from),
          target_lang: deeplTargetLang(to),
          tag_handling: 'xml',
          ignore_tags: ['ph'],
          preserve_formatting: true,
        }),
      },
      { fetch, sleep, label: 'DeepL' },
    );
    return (data.translations ?? []).map((item) => item.text);
  },
};

export default deeplProvider;
