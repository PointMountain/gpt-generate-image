import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const requireFromScript = createRequire(import.meta.url);
const playwrightTestCli = requireFromScript.resolve('@playwright/test/cli');

const env = {
  ...process.env,
  NO_PROXY: '127.0.0.1,localhost',
  no_proxy: '127.0.0.1,localhost',
  HTTP_PROXY: '',
  HTTPS_PROXY: '',
  ALL_PROXY: '',
  http_proxy: '',
  https_proxy: '',
  all_proxy: '',
};

const child = spawn(process.execPath, [playwrightTestCli, 'test'], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
