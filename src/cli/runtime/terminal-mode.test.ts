import { describe, expect, it } from 'vitest';
import {
  MAX_GENERATION_COUNT,
  shouldRenderInkCommandOutput,
  shouldUseInteractiveTerminal,
} from './terminal-mode';

describe('terminal-mode', () => {
  it('requires both stdin and stdout to be interactive for the root TUI', () => {
    expect(shouldUseInteractiveTerminal(true, true)).toBe(true);
    expect(shouldUseInteractiveTerminal(true, false)).toBe(false);
    expect(shouldUseInteractiveTerminal(false, true)).toBe(false);
  });

  it('keeps ink rendering for JSON output and TTY text output only', () => {
    expect(shouldRenderInkCommandOutput(true, false)).toBe(false);
    expect(shouldRenderInkCommandOutput(false, true)).toBe(true);
    expect(shouldRenderInkCommandOutput(false, false)).toBe(false);
  });

  it('shares the same generation count ceiling across CLI entry points', () => {
    expect(MAX_GENERATION_COUNT).toBe(10);
  });
});
