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

  it('routes OpenAI API requests to Worker proxy before static assets', async () => {
    const assets = createAssets();
    const env: TokenCanvasWorkerEnv = {
      ASSETS: assets,
      OPENAI_API_KEY: 'sk-worker-secret',
      TOKENCANVAS_PROXY_TOKEN: 'proxy-token',
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleTokenCanvasWorkerRequest(
      new Request('https://token-canvas.example/api/openai/models', {
        headers: { 'x-tokencanvas-proxy-token': 'proxy-token' },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(assets.fetch).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.any(Object));
  });

  it('does not serve API requests from static assets when proxy configuration is missing', async () => {
    const assets = createAssets();

    const response = await handleTokenCanvasWorkerRequest(
      new Request('https://token-canvas.example/api/openai/models'),
      { ASSETS: assets },
    );

    expect(response.status).toBe(500);
    expect(assets.fetch).not.toHaveBeenCalled();
  });
});
