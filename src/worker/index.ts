import { handleWorkerOpenAIProxy, type WorkerOpenAIProxyEnv } from './openai-proxy';

export interface TokenCanvasWorkerEnv extends WorkerOpenAIProxyEnv {
  ASSETS?: {
    fetch(request: Request): Promise<Response> | Response;
  };
}

function isOpenAIProxyRequest(request: Request) {
  return new URL(request.url).pathname.startsWith('/api/openai/');
}

function missingAssetsResponse() {
  return Response.json({
    error: 'missing_assets_binding',
    detail: 'Cloudflare static assets binding is not configured.',
  }, { status: 500 });
}

export async function handleTokenCanvasWorkerRequest(
  request: Request,
  env: TokenCanvasWorkerEnv,
): Promise<Response> {
  if (isOpenAIProxyRequest(request)) {
    return handleWorkerOpenAIProxy(request, env);
  }

  if (!env.ASSETS) {
    return missingAssetsResponse();
  }

  return env.ASSETS.fetch(request);
}

export default {
  fetch: handleTokenCanvasWorkerRequest,
};
