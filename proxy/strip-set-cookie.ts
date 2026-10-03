// ===== STRIP SET-COOKIE (internal, not exported from `ab-nextjs-i18n/proxy`) ===== //

import { NextResponse } from 'next/server';

/** `true` when a `Set-Cookie` header value sets the cookie `name`. */
function setsCookie(header: string, name: string): boolean {
  return header.trimStart().startsWith(`${name}=`);
}

/**
 * Removes every `Set-Cookie` for `name` from `response` (next-intl's cookie sync)
 * and keeps all the other cookies and headers.
 *
 * It rebuilds the headers from `headers.getSetCookie()` instead of calling
 * `response.cookies.delete(name)`, which would send an *expiring* cookie and wipe
 * the user's saved pick. It also fixes Next.js' `x-middleware-set-cookie` header
 * (the cookies Server Components see on this request), and returns a new
 * `NextResponse` so a later `response.cookies.set()` can't bring the cookie back.
 */
export function stripSetCookie(response: Response, name: string): Response {
  const all = response.headers.getSetCookie();
  const kept = all.filter((header) => !setsCookie(header, name));
  if (kept.length === all.length) return response;

  const headers = new Headers(response.headers);
  headers.delete('set-cookie');
  for (const header of kept) headers.append('set-cookie', header);

  if (headers.has('x-middleware-set-cookie')) {
    if (kept.length > 0) headers.set('x-middleware-set-cookie', kept.join(','));
    else headers.delete('x-middleware-set-cookie');
  }

  return new NextResponse(response.body, { status: response.status, statusText: response.statusText, headers });
}
