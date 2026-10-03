// ===== OpenAI provider ===== //
// Env: OPENAI_API_KEY, AB_I18N_OPENAI_MODEL (default: gpt-6-luna).

import { requestJson } from '../lib/http.mjs';

export const DEFAULT_OPENAI_MODEL = 'gpt-6-luna';

export function buildOpenAIMessages({ texts, from, to, glossary }) {
  const terms = glossary?.terms?.[to] ?? {};
  const termLines = Object.entries(terms).map(([source, target]) => `- "${source}" → "${target}"`);
  const system = [
    `You translate user-interface strings of a web app from ${from} to ${to}.`,
    'Rules:',
    '- Keep every <ph id="N"/> token exactly once, unchanged (they are placeholders such as names or numbers). You may move them to fit the grammar.',
    '- Keep XML tags such as <b>…</b> or <link>…</link> around the matching words. Never add or remove tags.',
    '- Keep the tone short and natural for UI. Do not add quotes, notes or explanations.',
    ...(glossary?.doNotTranslate?.length ? [`- Never translate: ${glossary.doNotTranslate.join(', ')}.`] : []),
    ...(termLines.length ? ['- Use these translations:', ...termLines] : []),
    `Answer with JSON: {"translations": [...]} containing exactly ${texts.length} strings, in the same order.`,
  ].join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ texts }) },
  ];
}

const openaiProvider = {
  name: 'openai',
  batchSize: 40,
  envKeys: ['OPENAI_API_KEY'],
  isAvailable: (env) => Boolean(env.OPENAI_API_KEY),

  async translate({ texts, from, to, glossary, env, fetch, sleep }) {
    const data = await requestJson(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.AB_I18N_OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
          response_format: { type: 'json_object' },
          messages: buildOpenAIMessages({ texts, from, to, glossary }),
        }),
      },
      { fetch, sleep, label: 'OpenAI' },
    );
    const content = data.choices?.[0]?.message?.content ?? '';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('OpenAI: the response is not JSON');
    }
    if (!Array.isArray(parsed.translations) || parsed.translations.length !== texts.length) {
      throw new Error(`OpenAI: expected ${texts.length} translations`);
    }
    return parsed.translations.map(String);
  },
};

export default openaiProvider;
