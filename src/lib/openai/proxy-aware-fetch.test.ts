import { describe, expect, it, vi } from 'vitest';
import { createProxyAwareFetch, parseProxyPreference, withoutProxyEnvironment } from './proxy-aware-fetch';

describe('proxy-aware-fetch', () => {
  it('parses explicit proxy preferences', () => {
    expect(parseProxyPreference('on')).toBe(true);
    expect(parseProxyPreference('true')).toBe(true);
    expect(parseProxyPreference('off')).toBe(false);
    expect(parseProxyPreference(undefined)).toBe(false);
  });

  it('temporarily removes proxy environment variables while running a no-proxy request', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.local:8080';

    await withoutProxyEnvironment(async () => {
      expect(process.env.HTTPS_PROXY).toBeUndefined();
    });

    expect(process.env.HTTPS_PROXY).toBe('http://proxy.local:8080');
    delete process.env.HTTPS_PROXY;
  });

  it('wraps fetch calls when proxy usage is disabled', async () => {
    process.env.HTTP_PROXY = 'http://proxy.local:8080';
    const fetcher = (async () => {
      expect(process.env.HTTP_PROXY).toBeUndefined();
      return new Response('{}');
    }) as typeof fetch;

    await createProxyAwareFetch(false, fetcher)('https://example.com');

    expect(process.env.HTTP_PROXY).toBe('http://proxy.local:8080');
    delete process.env.HTTP_PROXY;
  });

  it('serializes proxy-on requests behind no-proxy requests so environment restoration stays correct', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.local:8080';
    let releaseNoProxyRequest: (() => void) | undefined;
    const noProxyStarted = vi.fn();
    const proxyStarted = vi.fn();

    const noProxyFetch = createProxyAwareFetch(false, vi.fn(async () => {
      noProxyStarted();
      expect(process.env.HTTPS_PROXY).toBeUndefined();
      await new Promise<void>((resolve) => {
        releaseNoProxyRequest = resolve;
      });
      return new Response('{}');
    }) as typeof fetch);

    const proxyFetch = createProxyAwareFetch(true, vi.fn(async () => {
      proxyStarted();
      expect(process.env.HTTPS_PROXY).toBe('http://proxy.local:8080');
      return new Response('{}');
    }) as typeof fetch);

    const noProxyPromise = noProxyFetch('https://example.com/no-proxy');
    await Promise.resolve();
    const proxyPromise = proxyFetch('https://example.com/with-proxy');
    await Promise.resolve();

    expect(noProxyStarted).toHaveBeenCalledTimes(1);
    expect(proxyStarted).not.toHaveBeenCalled();

    releaseNoProxyRequest?.();
    await noProxyPromise;
    await proxyPromise;

    expect(proxyStarted).toHaveBeenCalledTimes(1);
    expect(process.env.HTTPS_PROXY).toBe('http://proxy.local:8080');
    delete process.env.HTTPS_PROXY;
  });

  it('allows proxy-on requests to run without waiting on each other', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.local:8080';
    let releaseRequests: (() => void) | undefined;
    const started: string[] = [];

    const proxiedFetch = createProxyAwareFetch(true, vi.fn(async (input) => {
      started.push(String(input));
      expect(process.env.HTTPS_PROXY).toBe('http://proxy.local:8080');
      await new Promise<void>((resolve) => {
        if (!releaseRequests) {
          releaseRequests = resolve;
          return;
        }

        resolve();
      });
      return new Response('{}');
    }) as typeof fetch);

    const first = proxiedFetch('https://example.com/first');
    const second = proxiedFetch('https://example.com/second');
    await Promise.resolve();

    expect(started).toEqual([
      'https://example.com/first',
      'https://example.com/second',
    ]);

    releaseRequests?.();
    await Promise.all([first, second]);

    delete process.env.HTTPS_PROXY;
  });
});
