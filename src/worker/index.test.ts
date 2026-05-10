import { describe, expect, it, vi } from 'vitest';
import { handleTokenCanvasWorkerRequest, type TokenCanvasWorkerEnv } from './index';

function createAssets(html = '<!doctype html><div id="root"></div>') {
  return {
    fetch: vi.fn(async () => new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })),
  };
}

describe('token canvas worker', () => {
  it('serves static assets for app shell requests', async () => {
    const assets = createAssets();

    const response = await handleTokenCanvasWorkerRequest(
      new Request('https://token-canvas.example/'),
      { ASSETS: assets },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('root');
    expect(assets.fetch).toHaveBeenCalledTimes(1);
  });

  it('lets Cloudflare assets handle SPA fallback paths', async () => {
    const assets = createAssets();

    await handleTokenCanvasWorkerRequest(
      new Request('https://token-canvas.example/workbench/history'),
      { ASSETS: assets },
    );

    expect(assets.fetch).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://token-canvas.example/workbench/history',
    }));
  });

  it('serves OpenAI API-looking paths as static fallback instead of proxying secrets', async () => {
    const assets = createAssets();
    const env: TokenCanvasWorkerEnv = {
      ASSETS: assets,
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleTokenCanvasWorkerRequest(
      new Request('https://token-canvas.example/api/openai/models'),
      env,
    );

    expect(response.status).toBe(200);
    expect(assets.fetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the static assets binding is missing', async () => {
    const response = await handleTokenCanvasWorkerRequest(
      new Request('https://token-canvas.example/'),
      {},
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'missing_assets_binding',
    });
  });
});
