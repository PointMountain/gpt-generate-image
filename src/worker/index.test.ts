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

  it('routes OpenAI API paths through the user-key proxy instead of static assets', async () => {
    const assets = createAssets();
    const env: TokenCanvasWorkerEnv = {
      ASSETS: assets,
    };
    const fetchMock = vi.fn(async () => Response.json({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleTokenCanvasWorkerRequest(
      new Request('https://token-canvas.example/api/openai/models', {
        headers: {
          authorization: 'Bearer sk-test',
          'x-openai-base-url': 'https://api.openai.com/v1',
        },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(assets.fetch).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://api.openai.com/v1/models'), expect.objectContaining({
      headers: expect.any(Headers),
      method: 'GET',
    }));
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
