import { describe, expect, it } from 'vitest';
import { requestJson } from '../cli/lib/http.mjs';
import { redactSecrets, secretEnvValues } from '../cli/lib/redact.mjs';
import { translateJobs } from '../cli/translate.mjs';

const textResponse = (status: number, body: string) => new Response(body, { status });

describe('secret redaction', () => {
  it('hides configured values and key-shaped strings, keeps normal words', () => {
    const out = redactSecrets('key my-google-key-123 bad; also sk-proj-AbC_9-x and 1a2b-3c4d:fx; task-list ok', ['my-google-key-123', 'x', undefined]);
    expect(out).toBe('key [redacted] bad; also [redacted] and [redacted]; task-list ok');
    expect(secretEnvValues({ OPENAI_API_KEY: 'sk-1', AB_I18N_OPENAI_MODEL: 'gpt-x', OTHER: 'no' }, ['OPENAI_API_KEY', 'AB_I18N_OPENAI_MODEL'])).toEqual(['sk-1']);
  });

  it('redacts provider error bodies that echo the key (headers, JSON api_key, patterns)', async () => {
    const echo = async (_url: string, init: any) => textResponse(403, `invalid credentials: ${init.headers.Authorization} / ${JSON.parse(init.body).api_key}`);
    const error = await requestJson(
      'https://api.example.com/x',
      { method: 'POST', headers: { Authorization: 'DeepL-Auth-Key 0000-1111-2222:fx' }, body: JSON.stringify({ api_key: 'libre-secret-42' }) },
      { fetch: echo as any, label: 'Example' },
    ).catch((e) => e);
    expect(error.status).toBe(403);
    expect(error.message).toBe('Example: HTTP 403 invalid credentials: [redacted] / [redacted]');

    const unknownKey = async () => textResponse(401, '{"error":{"message":"Incorrect API key provided: sk-live-QWERTY123."}}');
    const error2 = await requestJson('https://api.example.com/x', {}, { fetch: unknownKey as any, label: 'Example' }).catch((e) => e);
    expect(error2.message).not.toMatch(/QWERTY/);
    expect(error2.message).toMatch(/\[redacted\]/);

    const networkError = async () => {
      throw new Error('connect failed for token=abcd-efgh-ijkl');
    };
    const error3 = await requestJson('https://api.example.com/x', {}, { fetch: networkError as any, retries: 0, secrets: ['abcd-efgh-ijkl'] }).catch((e) => e);
    expect(error3.message).toBe('api.example.com: network error (connect failed for token=[redacted])');
  });

  it('never writes a configured key into translate results / reports', async () => {
    const env = { DEEPL_API_KEY: 'deepl-pro-key-999', CUSTOM_TOKEN: 'custom-token-777' };
    const leaky = {
      name: 'leaky',
      batchSize: 10,
      envKeys: ['CUSTOM_TOKEN'],
      async translate() {
        throw new Error(`rejected ${env.DEEPL_API_KEY} and ${env.CUSTOM_TOKEN}`);
      },
    };
    const results = await translateJobs([{ key: 'App.title', source: 'Welcome' }], [leaky], {
      from: 'en',
      to: 'fr',
      glossary: { doNotTranslate: [], terms: {} },
      env,
    });
    const outcome = results.get('App.title')!;
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe('leaky: rejected [redacted] and [redacted]');
  });
});
