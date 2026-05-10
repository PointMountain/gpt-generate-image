const PROXY_ENV_KEYS = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'npm_config_proxy',
  'npm_config_https_proxy',
];

let activeProxyRequests = 0;
let noProxyActive = false;
let pendingNoProxyRequests = 0;
let pendingResolvers: Array<() => void> = [];

function hasProcessEnv() {
  return typeof process !== 'undefined' && Boolean(process.env);
}

export function parseProxyPreference(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export async function withoutProxyEnvironment<T>(run: () => Promise<T>): Promise<T> {
  if (!hasProcessEnv()) {
    return run();
  }

  const previousValues = new Map<string, string | undefined>();
  for (const key of PROXY_ENV_KEYS) {
    previousValues.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function withSerializedProxyEnvironment<T>(useProxy: boolean, run: () => Promise<T>): Promise<T> {
  if (!hasProcessEnv()) {
    return run();
  }

  if (useProxy) {
    await waitForProxyWindow(() => !noProxyActive && pendingNoProxyRequests === 0);
    activeProxyRequests += 1;

    try {
      return await run();
    } finally {
      activeProxyRequests = Math.max(activeProxyRequests - 1, 0);
      flushProxyWaiters();
    }
  }

  pendingNoProxyRequests += 1;
  await waitForProxyWindow(() => !noProxyActive && activeProxyRequests === 0);
  pendingNoProxyRequests = Math.max(pendingNoProxyRequests - 1, 0);
  noProxyActive = true;

  try {
    return await withoutProxyEnvironment(run);
  } finally {
    noProxyActive = false;
    flushProxyWaiters();
  }
}

export function createProxyAwareFetch(useProxy: boolean, fetcher: typeof fetch = fetch): typeof fetch {
  return ((input, init) => withSerializedProxyEnvironment(useProxy, () => fetcher(input, init))) as typeof fetch;
}

function flushProxyWaiters() {
  const resolvers = pendingResolvers;
  pendingResolvers = [];
  resolvers.forEach((resolve) => resolve());
}

async function waitForProxyWindow(canProceed: () => boolean) {
  while (!canProceed()) {
    await new Promise<void>((resolve) => {
      pendingResolvers.push(resolve);
    });
  }
}
