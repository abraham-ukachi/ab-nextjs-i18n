// ===== HTTP WITH BACKOFF ===== //

import { redactSecrets, requestSecrets } from './redact.mjs';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


/**
 * `fetch` + JSON with retries on 429 / 5xx / network errors (exponential
 * backoff, honours `Retry-After`). Error messages never include request headers, and
 * the response body / network error they quote is redacted: the auth headers and
 * `api_key` sent, `options.secrets`, and anything shaped like an API key.
 *
 * @param { string } url
 * @param { RequestInit } init
 * @param {{ fetch?: typeof fetch, sleep?: (ms: number) => Promise<void>, retries?: number, baseDelay?: number, label?: string, secrets?: string[] }} [options]
 */
export async function requestJson(url, init, options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? defaultSleep;
  const retries = options.retries ?? 5;
  const baseDelay = options.baseDelay ?? 500;
  const label = options.label ?? new URL(url).host;
  const secrets = [...requestSecrets(init), ...(options.secrets ?? [])];
  const redact = (text) => redactSecrets(text, secrets);

  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, init);
    } catch (error) {
      if (attempt >= retries) throw new Error(redact(`${label}: network error (${error.message})`));
      await sleep(baseDelay * 2 ** attempt);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt >= retries) throw new HttpError(response.status, `${label}: HTTP ${response.status} after ${retries + 1} attempts`);
      const retryAfter = Number(response.headers?.get?.('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseDelay * 2 ** attempt;
      await sleep(Math.min(delay, 60_000));
      continue;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new HttpError(response.status, `${label}: HTTP ${response.status} ${redact(body).slice(0, 200)}`.trim());
    }
    return response.json();
  }
}
