import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
}

interface DropdownFieldProps {
  id: string;
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function clampIndex(index: number, options: DropdownOption[]) {
  const enabledOptions = options.filter((option) => !option.disabled);
  if (!enabledOptions.length) {
    return -1;
  }

  const normalizedIndex = ((index % enabledOptions.length) + enabledOptions.length) % enabledOptions.length;
  return options.findIndex((option) => option.value === enabledOptions[normalizedIndex].value);
}

export function DropdownField({
  id,
  label,
  value,
  options,
  onChange,
  hint,
  error,
  placeholder = '选择',
  disabled = false,
  className = '',
}: DropdownFieldProps) {
  const listboxId = `${id}-listbox`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const hasOpenedRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(() => clampIndex(Math.max(selectedIndex, 0), options));
  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const visibleValue = selectedOption?.label ?? (value || placeholder);
  const enabledOptions = useMemo(() => options.filter((option) => !option.disabled), [options]);

  useEffect(() => {
    setActiveIndex(clampIndex(Math.max(selectedIndex, 0), options));
  }, [options, selectedIndex]);

  useEffect(() => {
    // 打开后把焦点稳定留在 listbox，自定义键盘导航和 aria-activedescendant 才一致。
    if (isOpen) {
      hasOpenedRef.current = true;
      listboxRef.current?.focus();
      return;
    }

    if (hasOpenedRef.current) {
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  function open(nextIndex = activeIndex) {
    if (disabled || !enabledOptions.length) {
      return;
    }

    setActiveIndex(clampIndex(nextIndex < 0 ? Math.max(selectedIndex, 0) : nextIndex, options));
    setIsOpen(true);
  }

  function selectOption(option: DropdownOption) {
    if (option.disabled) {
      return;
    }

    onChange(option.value);
    setIsOpen(false);
  }

  function moveActive(delta: number) {
    const enabledIndex = enabledOptions.findIndex((option) => option.value === options[activeIndex]?.value);
    const nextEnabledIndex = enabledIndex < 0 ? 0 : enabledIndex + delta;
    setActiveIndex(clampIndex(nextEnabledIndex, options));
  }

  function close() {
    setIsOpen(false);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        open(Math.max(selectedIndex, 0));
      } else {
        moveActive(1);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        open(Math.max(selectedIndex, 0));
      } else {
        moveActive(-1);
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }

      const activeOption = options[activeIndex];
      if (activeOption) {
        selectOption(activeOption);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  function handleListboxKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(clampIndex(0, options));
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(clampIndex(enabledOptions.length - 1, options));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const activeOption = options[activeIndex];
      if (activeOption) {
        selectOption(activeOption);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'Tab') {
      close();
    }
  }

  return (
    <div
      className={`field dropdown-field ${className}`.trim()}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          close();
        }
      }}
    >
      <label id={`${id}-label`} htmlFor={id}>{label}</label>
      <input type="hidden" id={id} value={value} readOnly />
      <button
        ref={triggerRef}
        type="button"
        className="dropdown-field__trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-controls={listboxId}
        disabled={disabled}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => (isOpen ? close() : open())}
      >
        <span id={`${id}-value`} className="dropdown-field__value">{visibleValue}</span>
        {selectedOption?.badge ? <span className="dropdown-field__badge">{selectedOption.badge}</span> : null}
        <svg className="dropdown-field__chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m3.5 5.75 4.5 4.5 4.5-4.5" />
        </svg>
      </button>
      {isOpen ? (
        <div
          ref={listboxRef}
          className="dropdown-field__popover"
          role="listbox"
          id={listboxId}
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={activeOptionId}
          onKeyDown={handleListboxKeyDown}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${listboxId}-option-${index}`}
              className="dropdown-field__option"
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled ? 'true' : undefined}
              data-active={index === activeIndex ? 'true' : undefined}
              onMouseEnter={() => {
                if (!option.disabled) {
                  setActiveIndex(index);
                }
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
            >
              <span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
              {option.badge ? <em>{option.badge}</em> : null}
            </div>
          ))}
        </div>
      ) : null}
      {error ? <span className="field__error">{error}</span> : null}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}
