export interface TokenCanvasWorkerEnv {
  ASSETS?: {
    fetch(request: Request): Promise<Response> | Response;
  };
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
  if (!env.ASSETS) {
    return missingAssetsResponse();
  }

  return env.ASSETS.fetch(request);
}

export default {
  fetch: handleTokenCanvasWorkerRequest,
};
