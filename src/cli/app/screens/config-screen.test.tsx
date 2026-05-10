import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { ConfigScreen } from './config-screen';

describe('ConfigScreen', () => {
  it('states that terminal config is separate from browser storage', () => {
    const { lastFrame } = render(<ConfigScreen onSave={vi.fn()} />);

    expect(lastFrame()).toContain('不读取浏览器 localStorage/IndexedDB');
    expect(lastFrame()).toContain('TokenCanvas 终端配置');
  });
});
