import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import {
  CommandInput,
  completeCommandValue,
  findCommandMatches,
  removeCurrentInputLine,
  resolveSubmittedCommand,
  type SlashCommandDefinition,
} from './command-input';

const commands: SlashCommandDefinition[] = [
  { name: '/mode', syntax: '/mode [text|image|mask]', description: '选择模式' },
  { name: '/mask', syntax: '/mask [mask.png]', description: '设置 mask' },
  { name: '/generate', syntax: '/generate [prompt]', description: '开始生成' },
];

describe('CommandInput', () => {
  it('shows matching commands and exposes tab completion behavior', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(<CommandInput commands={commands} initialValue="/mod" onSubmit={onSubmit} />);

    expect(lastFrame()).toContain('/mode');
    expect(lastFrame()).toContain('选择模式');
    expect(lastFrame()).not.toContain('/mode [text|image|mask]');
    expect(lastFrame()).not.toContain('Tab 补全');
    expect(completeCommandValue(commands, '/mod')).toBe('/mode ');
    expect(resolveSubmittedCommand(commands, '/mod')).toBe('/mode');
  });

  it('hides suggestions and shows syntax placeholder after completion', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(<CommandInput commands={commands} initialValue="/mode " onSubmit={onSubmit} />);

    expect(lastFrame()).toContain('/mode');
    expect(lastFrame()).toContain('[text|image|mask]');
    expect(lastFrame()).not.toContain('Tab 补全');
    expect(lastFrame()).not.toContain('选择模式');
  });

  it('keeps explicit arguments when submitting a command', () => {
    expect(resolveSubmittedCommand(commands, '/generate 海绵宝宝')).toBe('/generate 海绵宝宝');
  });

  it('completes the highlighted suggestion instead of always using the first match', () => {
    expect(completeCommandValue(commands, '/m', 1)).toBe('/mask ');
    expect(resolveSubmittedCommand(commands, '/m', 1)).toBe('/mask');
  });

  it('matches commands by description as well as command name', () => {
    expect(findCommandMatches(commands, '/生成').map((command) => command.name)).toEqual(['/generate']);
    expect(findCommandMatches(commands, '/选择').map((command) => command.name)).toEqual(['/mode']);
  });

  it('prioritizes command-name fuzzy matches before description matches', () => {
    const rankedCommands: SlashCommandDefinition[] = [
      { name: '/help', syntax: '/help', description: '查看 mode 相关帮助' },
      { name: '/mode', syntax: '/mode [text|image|mask]', description: '选择模式' },
      { name: '/output-mode', syntax: '/output-mode [auto]', description: '设置输出模式' },
    ];

    expect(findCommandMatches(rankedCommands, '/mode').map((command) => command.name)).toEqual([
      '/mode',
      '/output-mode',
      '/help',
    ]);
  });

  it('removes only the current line for line-clear shortcuts', () => {
    expect(removeCurrentInputLine('海绵宝宝')).toBe('');
    expect(removeCurrentInputLine('第一行\n第二行')).toBe('第一行\n');
  });
});
