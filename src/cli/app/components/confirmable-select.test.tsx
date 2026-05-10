import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { ConfirmableSelect } from './confirmable-select';

const options = [
  { label: '文生图 text', value: 'text' },
  { label: '图生图 image', value: 'image' },
  { label: '遮罩编辑 mask', value: 'mask' },
];

async function waitForInput() {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('ConfirmableSelect', () => {
  it('submits the current default option when pressing enter without changing selection', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <ConfirmableSelect options={options} defaultValue="text" onSubmit={onSubmit} />,
    );

    await waitForInput();
    stdin.write('\r');
    await waitForInput();

    expect(onSubmit).toHaveBeenCalledWith('text');
  });

  it('moves focus with arrows and submits the focused option', async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <ConfirmableSelect options={options} defaultValue="text" onSubmit={onSubmit} />,
    );

    await waitForInput();
    stdin.write('\u001B[B');
    await waitForInput();
    stdin.write('\r');
    await waitForInput();

    expect(onSubmit).toHaveBeenCalledWith('image');
  });

  it('supports controlled highlight updates without keeping a second selection source', async () => {
    const onSubmit = vi.fn();
    const onHighlightChange = vi.fn();
    const { stdin, rerender } = render(
      <ConfirmableSelect
        options={options}
        value="text"
        onHighlightChange={onHighlightChange}
        onSubmit={onSubmit}
      />,
    );

    await waitForInput();
    stdin.write('\u001B[B');
    await waitForInput();

    expect(onHighlightChange).toHaveBeenCalledWith('image', 1);

    rerender(
      <ConfirmableSelect
        options={options}
        value="image"
        onHighlightChange={onHighlightChange}
        onSubmit={onSubmit}
      />,
    );
    await waitForInput();

    stdin.write('\r');
    await waitForInput();

    expect(onSubmit).toHaveBeenCalledWith('image');
  });
});
