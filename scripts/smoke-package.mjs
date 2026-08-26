import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';

const COMMAND_TIMEOUT_MS = 180_000;
const DISALLOWED_PACKLIST_PATTERNS = [
  /^src\/.*\.test\./,
  /^docs\/plans\//,
  /^docs\/solutions\//,
  /^\.env/,
  /tokencanvas-output/,
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: COMMAND_TIMEOUT_MS,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`,
      result.error ? `error: ${result.error.message}` : '',
      result.signal ? `signal: ${result.signal}` : '',
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n'));
  }

  return result;
}

async function findOpenPort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once('error', rejectPort);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => {
        if (error) {
          rejectPort(error);
          return;
        }

        resolvePort(port);
      });
    });
  });
}

async function waitForWebUI(url, child) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`tokencanvas web exited early with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(url);
      const body = await response.text();
      if (response.ok && body.includes('<title>造境｜AI 图片创作台</title>')) {
        return;
      }
      lastError = new Error(`unexpected response ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`tokencanvas web did not serve ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function smokeWebCommand(binPath, tempDir) {
  const port = await findOpenPort();
  const child = spawn(binPath, ['web', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: tempDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = [];

  child.stdout.on('data', (chunk) => output.push(chunk.toString()));
  child.stderr.on('data', (chunk) => output.push(chunk.toString()));

  try {
    await waitForWebUI(`http://127.0.0.1:${port}/`, child);
    await waitForWebUI(`http://127.0.0.1:${port}/workbench/history`, child);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('close', resolve));
    }
  }

  if (output.join('').includes('启动失败')) {
    throw new Error(`tokencanvas web reported startup failure:\n${output.join('')}`);
  }
}

function parsePackOutput(stdout) {
  const payload = JSON.parse(stdout);
  const pack = Array.isArray(payload) ? payload[0] : payload;
  if (!pack?.files || !Array.isArray(pack.files)) {
    throw new Error('npm pack output did not include a files array');
  }
  return pack;
}

const dryRun = parsePackOutput(run('npm', ['pack', '--dry-run', '--json']).stdout);
const filePaths = dryRun.files.map((file) => file.path);

for (const filePath of filePaths) {
  if (DISALLOWED_PACKLIST_PATTERNS.some((pattern) => pattern.test(filePath))) {
    throw new Error(`Disallowed file in npm packlist: ${filePath}`);
  }
}

for (const requiredPath of ['dist/cli/main.js', 'dist/cli/commands/generate.js', 'dist/cli/commands/web.js', 'dist/web/index.html', 'README.md', 'LICENSE']) {
  if (!filePaths.includes(requiredPath)) {
    throw new Error(`Required file missing from npm packlist: ${requiredPath}`);
  }
}

const packed = parsePackOutput(run('npm', ['pack', '--json']).stdout);
const tarballPath = resolve(packed.filename);
const tempDir = await mkdtemp(join(tmpdir(), 'tokencanvas-package-smoke-'));

try {
  run('npm', ['init', '-y'], { cwd: tempDir });
  run('npm', ['install', tarballPath], { cwd: tempDir });
  const binPath = join(tempDir, 'node_modules', '.bin', 'tokencanvas');
  const help = run(binPath, ['--help'], { cwd: tempDir });

  if (!help.stdout.includes('TokenCanvas terminal image workbench')) {
    throw new Error('tokencanvas --help did not render expected help text');
  }

  await smokeWebCommand(binPath, tempDir);
} finally {
  await rm(tempDir, { recursive: true, force: true });
  await rm(tarballPath, { force: true });
}

console.log('Package smoke passed');
