import { describe, expect, it } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { defineRouting } from 'next-intl/routing';
import { defineAbI18n, toAbRouting } from '../config.js';
import { createAbI18nProxy } from '../proxy';
import { stripSetCookie } from '../proxy/strip-set-cookie';

const config = defineAbI18n();
const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(path, 'http://localhost'), { headers: { 'accept-language': 'en-US,en;q=0.9', ...headers } });
const localeCookies = (response: Response) => response.headers.getSetCookie().filter((c) => c.startsWith('NEXT_LOCALE='));

describe('createAbI18nProxy: the locale cookie', () => {
  it('never sets NEXT_LOCALE on a plain /fr visit (next-intl would set a session cookie)', async () => {
    // control: next-intl alone writes a session cookie here
    const raw = createMiddleware(defineRouting(toAbRouting(config)))(request('/fr'));
    expect(localeCookies(raw)).toEqual([expect.stringMatching(/^NEXT_LOCALE=fr; Path=\/; SameSite=lax$/)]);

    const proxy = createAbI18nProxy(config);
    const response = await proxy(request('/fr'));
    expect(response.status).toBe(200);
    expect(localeCookies(response)).toEqual([]);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-middleware-set-cookie') ?? '').not.toContain('NEXT_LOCALE');
  });

  it('does not overwrite a saved pick: /fr with NEXT_LOCALE=ru sends no cookie, / still follows the cookie', async () => {
    const proxy = createAbI18nProxy(config);
    expect(localeCookies(createMiddleware(defineRouting(toAbRouting(config)))(request('/fr', { cookie: 'NEXT_LOCALE=ru' })))).toHaveLength(1);
    const fr = await proxy(request('/fr', { cookie: 'NEXT_LOCALE=ru' }));
    expect(localeCookies(fr)).toEqual([]);
    expect(fr.headers.get('set-cookie')).toBeNull();

    const root = await proxy(request('/', { cookie: 'NEXT_LOCALE=ru' }));
    expect(root.status).toBe(307);
    expect(root.headers.get('location')).toBe('http://localhost/ru');
    expect(localeCookies(root)).toEqual([]);
  });

  it('keeps the other cookies, including ones onResponse sets afterwards', async () => {
    const proxy = createAbI18nProxy(config, {
      onResponse(_request, response) {
        response.cookies.set('theme', 'dark');
        response.headers.set('x-frame-options', 'DENY');
      },
    });
    const response = await proxy(request('/es', { 'accept-language': 'fr' }));
    expect(response.headers.getSetCookie()).toEqual([expect.stringMatching(/^theme=dark/)]);
    expect(response.headers.get('x-middleware-set-cookie')).not.toContain('NEXT_LOCALE');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });

  it('skips onResponse when onRequest returned a response', async () => {
    let called = false;
    const proxy = createAbI18nProxy(config, {
      onRequest: () => NextResponse.redirect(new URL('/login', 'http://localhost')),
      onResponse: () => void (called = true),
    });
    const response = await proxy(request('/account'));
    expect(response.headers.get('location')).toBe('http://localhost/login');
    expect(called).toBe(false);
  });
});

describe('stripSetCookie', () => {
  it('removes only the named cookie (no expiring cookie) and fixes x-middleware-set-cookie', () => {
    const response = NextResponse.next();
    response.cookies.set('session', 'abc', { httpOnly: true });
    response.cookies.set('NEXT_LOCALE', 'fr', { sameSite: 'lax' });
    response.cookies.set('theme', 'dark');
    expect(response.headers.getSetCookie()).toHaveLength(3);

    const stripped = stripSetCookie(response, 'NEXT_LOCALE');
    const cookies = stripped.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toMatch(/^session=abc; Path=\/; HttpOnly/);
    expect(cookies[1]).toMatch(/^theme=dark/);
    expect(cookies.join('\n')).not.toMatch(/NEXT_LOCALE/);
    expect(stripped.headers.get('x-middleware-set-cookie')).toBe(cookies.join(','));
    expect(stripped.headers.get('x-middleware-next')).toBe('1');
  });

  it('returns the same response when there is nothing to strip', () => {
    const response = NextResponse.next();
    response.cookies.set('theme', 'dark');
    expect(stripSetCookie(response, 'NEXT_LOCALE')).toBe(response);
  });
});
