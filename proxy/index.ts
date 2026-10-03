// ===== AB I18N PROXY ===== //

import createMiddleware from 'next-intl/middleware';
import { defineRouting } from 'next-intl/routing';
import type { NextRequest, NextResponse } from 'next/server';
import { toAbRouting } from '../config';
import type { AbI18nConfig } from '../config';

export type AbProxyResult = Response | NextResponse | undefined | null | void;

export interface AbI18nProxyOptions {
  /**
   * Runs before the i18n proxy (e.g. an auth guard). Return a `Response`
   * (redirect, rewrite, 401...) to stop there, or nothing to continue.
   * Never call React hooks or query a database here.
   */
  onRequest?: (request: NextRequest) => AbProxyResult | Promise<AbProxyResult>;
  /** Runs after the i18n proxy, e.g. to add headers. Return a replacement response or nothing. */
  onResponse?: (request: NextRequest, response: NextResponse) => AbProxyResult | Promise<AbProxyResult>;
}

/**
 * The matcher `init` writes into `proxy.ts` (Next.js needs a literal there):
 * everything except API routes, Next.js / Vercel internals and files with an extension.
 */
export const AB_I18N_MATCHER = '/((?!api|trpc|_next|_vercel|.*\\..*).*)';


/**
 * Creates the default export of `proxy.ts` (Next.js 16's `middleware.ts`).
 */
export function createAbI18nProxy<L extends string>(
  config: AbI18nConfig<L>,
  options: AbI18nProxyOptions = {},
): (request: NextRequest) => Promise<Response> {
  const handleI18nRouting = createMiddleware(defineRouting(toAbRouting(config)));

  return async function abI18nProxy(request: NextRequest): Promise<Response> {
    if (options.onRequest) {
      const early = await options.onRequest(request);
      if (early) return early;
    }

    const response = handleI18nRouting(request);

    if (options.onResponse) {
      const replaced = await options.onResponse(request, response);
      if (replaced) return replaced;
    }
    return response;
  };
}
