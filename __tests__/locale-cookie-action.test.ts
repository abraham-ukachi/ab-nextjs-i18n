import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineAbI18n } from '../config.js';

const store = { set: vi.fn() };
vi.mock('next/headers', () => ({ cookies: async () => store }));

const { createAbLocaleCookieAction } = await import('../server');

afterEach(() => {
  store.set.mockReset();
  vi.unstubAllEnvs();
});

describe('createAbLocaleCookieAction', () => {
  it('saves a configured locale for one year (lax, path /, not secure outside production)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    await createAbLocaleCookieAction(defineAbI18n())('fr');
    expect(store.set).toHaveBeenCalledWith('NEXT_LOCALE', 'fr', { path: '/', sameSite: 'lax', maxAge: 31536000, secure: false });
  });

  it('uses the config cookie (name, maxAge) and secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const config = defineAbI18n({ locales: ['en', 'de'], localeCookie: { name: 'APP_LOCALE', maxAge: 600 } });
    await createAbLocaleCookieAction(config)('de');
    expect(store.set).toHaveBeenCalledWith('APP_LOCALE', 'de', { path: '/', sameSite: 'lax', maxAge: 600, secure: true });
  });

  it('rejects locales that are not in the config, and callers cannot pick the cookie', async () => {
    const action = createAbLocaleCookieAction(defineAbI18n());
    await expect(action('de')).rejects.toThrow(/Unsupported locale "de"/);
    await expect(action('fr; Max-Age=0')).rejects.toThrow(/Unsupported locale/);
    expect(action.length).toBe(1);
    expect(store.set).not.toHaveBeenCalled();
  });

  it('refuses a config without a locale cookie', () => {
    expect(() => createAbLocaleCookieAction(defineAbI18n({ localeCookie: false }))).toThrow(/disabled/);
  });
});
