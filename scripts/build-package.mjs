import { rm, chmod, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const COMMAND_TIMEOUT_MS = 180_000;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    timeout: COMMAND_TIMEOUT_MS,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`,
      result.error ? `error: ${result.error.message}` : '',
      result.signal ? `signal: ${result.signal}` : '',
    ].filter(Boolean).join('\n'));
  }
}

await rm('dist/cli', { recursive: true, force: true });
await rm('dist/web', { recursive: true, force: true });

run('pnpm', ['exec', 'vite', 'build', '--outDir', 'dist/web']);

const sharedBuildOptions = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  jsx: 'automatic',
  logLevel: 'info',
};

await build({
  ...sharedBuildOptions,
  entryPoints: ['src/cli/main.tsx'],
  outfile: 'dist/cli/main.js',
});

const cliMain = await readFile('dist/cli/main.js', 'utf8');
await writeFile(
  'dist/cli/main.js',
  cliMain.replace(/^#!\/usr\/bin\/env -S node --import tsx/, '#!/usr/bin/env node'),
);

await build({
  ...sharedBuildOptions,
  entryPoints: [
    'src/cli/commands/index.tsx',
    'src/cli/commands/generate.tsx',
    'src/cli/commands/web.tsx',
  ],
  outdir: 'dist/cli/commands',
  entryNames: '[name]',
});

await chmod('dist/cli/main.js', 0o755);
