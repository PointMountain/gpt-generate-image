import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropdownField } from './dropdown-field';

const OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'high', label: '高质量', description: '更适合最终图' },
  { value: 'low', label: '快速' },
];

describe('DropdownField', () => {
  it('does not steal focus when it first mounts', () => {
    render(
      <>
        <button type="button" autoFocus>关闭设置</button>
        <DropdownField
          id="quality"
          label="质量"
          value="auto"
          options={OPTIONS}
          onChange={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole('button', { name: '关闭设置' })).toHaveFocus();
  });

  it('opens options and selects a value with pointer input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DropdownField
        id="quality"
        label="质量"
        value="auto"
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /质量/ }));
    expect(screen.getByRole('listbox', { name: '质量' })).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: /高质量/ }));
    expect(onChange).toHaveBeenCalledWith('high');
    expect(screen.queryByRole('listbox', { name: '质量' })).not.toBeInTheDocument();
  });

  it('supports keyboard selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DropdownField
        id="quality"
        label="质量"
        value="auto"
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: /质量/ });
    trigger.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('high');
  });

  it('skips disabled options while navigating with the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DropdownField
        id="quality"
        label="质量"
        value="auto"
        options={[
          OPTIONS[0],
          { value: 'legacy', label: 'Legacy', disabled: true },
          OPTIONS[1],
        ]}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: /质量/ });
    trigger.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('high');
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <DropdownField
        id="quality"
        label="质量"
        value="auto"
        options={OPTIONS}
        onChange={onChange}
        disabled
      />,
    );

    await user.click(screen.getByRole('button', { name: /质量/ }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
