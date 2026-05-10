import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startTokenCanvasWebServer, type TokenCanvasWebServer } from './static-server';

const tempDirs: string[] = [];
const servers: TokenCanvasWebServer[] = [];

async function createWebRoot() {
  const dir = await mkdtemp(join(tmpdir(), 'tokencanvas-web-'));
  tempDirs.push(dir);
  await writeFile(join(dir, 'index.html'), '<!doctype html><div id="root">TokenCanvas</div>');
  await writeFile(join(dir, 'app.js'), 'globalThis.loaded = true;');
  return dir;
}

async function startServer(rootDir: string, port = 0, enableProxy = false) {
  const server = await startTokenCanvasWebServer({ rootDir, port, enableProxy });
  servers.push(server);
  return server;
}

describe('static web server', () => {
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('serves index and static assets', async () => {
    const rootDir = await createWebRoot();
    const server = await startServer(rootDir);

    await expect(fetch(server.url).then((response) => response.text())).resolves.toContain('TokenCanvas');
    const assetResponse = await fetch(`${server.url}/app.js`);

    expect(assetResponse.headers.get('content-type')).toContain('text/javascript');
    await expect(assetResponse.text()).resolves.toContain('loaded');
  });

  it('falls back to index for nested app routes', async () => {
    const rootDir = await createWebRoot();
    const server = await startServer(rootDir);

    const response = await fetch(`${server.url}/workbench/history`);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('TokenCanvas');
  });

  it('keeps local OpenAI proxy disabled unless requested', async () => {
    const rootDir = await createWebRoot();
    const server = await startServer(rootDir);

    const response = await fetch(`${server.url}/api/openai/models`);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({
      error: 'local_openai_proxy_disabled',
    });
  });

  it('returns a clear client error for malformed request paths', async () => {
    const rootDir = await createWebRoot();
    const server = await startServer(rootDir);

    const response = await fetch(`${server.url}/%E0%A4%A`);

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain('Invalid request URL');
  });

  it('fails clearly when assets are missing', async () => {
    const missingRoot = await mkdtemp(join(tmpdir(), 'tokencanvas-missing-web-'));
    tempDirs.push(missingRoot);

    await expect(startTokenCanvasWebServer({ rootDir: missingRoot, port: 0 })).rejects.toThrow();
  });
});
