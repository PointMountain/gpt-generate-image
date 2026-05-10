import process from 'node:process';

export const MAX_GENERATION_COUNT = 10;

export function shouldUseInteractiveTerminal(
  stdinIsTTY = process.stdin.isTTY,
  stdoutIsTTY = process.stdout.isTTY,
) {
  return Boolean(stdinIsTTY && stdoutIsTTY);
}

export function shouldRenderInkCommandOutput(
  jsonOutput: boolean,
  stdoutIsTTY = process.stdout.isTTY,
) {
  return !jsonOutput && Boolean(stdoutIsTTY);
}
