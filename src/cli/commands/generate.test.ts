import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizeGenerateCommandOptions, options } from './generate';

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

async function createTempDir(prefix: string) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function runCli(args: string[], env: Record<string, string> = {}) {
  try {
    return await execFileAsync(process.execPath, ['--import', 'tsx', 'src/cli/main.tsx', ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
    });
  } catch (error) {
    const commandError = error as Error & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    return {
      stdout: commandError.stdout ?? '',
      stderr: commandError.stderr ?? '',
      code: commandError.code ?? 1,
    };
  }
}

describe('generate command schema', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('normalizes default command options', () => {
    expect(options.parse({
      prompt: 'warm portrait',
    })).toMatchObject({
      prompt: 'warm portrait',
      mode: 'text',
      reference: [],
      count: 1,
      json: false,
    });
  });

  it('validates bounded CLI overrides for automation-friendly flags', () => {
    expect(() => options.parse({
      prompt: 'warm portrait',
      count: 0,
    })).toThrow();

    expect(() => options.parse({
      prompt: 'warm portrait',
      outputCompression: 101,
    })).toThrow();

    expect(options.parse({
      prompt: 'warm portrait',
      timeoutSeconds: 15,
      apiKey: 'sk-test',
      baseUrl: 'https://example.com/v1',
      size: '1024x1024',
    })).toMatchObject({
      timeoutSeconds: 15,
      apiKey: 'sk-test',
      baseUrl: 'https://example.com/v1',
      size: '1024x1024',
    });
  });

  it('maps baseUrl to the internal baseURL option contract', () => {
    const parsed = options.parse({
      prompt: 'warm portrait',
      baseUrl: 'https://example.com/v1',
      json: true,
    });

    expect(normalizeGenerateCommandOptions(parsed)).toMatchObject({
      baseURL: 'https://example.com/v1',
      json: true,
    });
  });

  it('prints parseable JSON from a real child process', async () => {
    const configDir = await createTempDir('tokencanvas-config-');
    const outputDir = await createTempDir('tokencanvas-output-');
    const result = await runCli([
      'generate',
      '--prompt',
      'test',
      '--json',
      '--api-key',
      'sk-test',
      '--base-url',
      'http://bad',
      '--output-dir',
      outputDir,
    ], {
      TOKENCANVAS_CONFIG_DIR: configDir,
    });

    expect(result.stderr).toBe('');
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({
      ok: false,
      message: 'baseURL 需要以 https:// 开头。',
    });
    expect(parsed.recommendation).toBeTruthy();
  });

  it('fails the root command fast outside an interactive terminal', async () => {
    const result = await runCli([]);

    expect(result.stdout.trim()).toBe('');
    expect(result.stderr).toContain('tokencanvas 需要交互式终端');
    expect(result.code).toBe(2);
  });
});
