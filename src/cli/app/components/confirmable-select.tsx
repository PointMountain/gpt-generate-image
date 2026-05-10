import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface SelectOption {
  label: string;
  value: string;
}

interface ConfirmableSelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  visibleOptionCount?: number;
  isDisabled?: boolean;
  onHighlightChange?: (value: string, index: number) => void;
  onSubmit: (value: string) => void;
}

function selectedIndexFor(options: SelectOption[], value?: string) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  return selectedIndex >= 0 ? selectedIndex : 0;
}

function visibleRange(activeIndex: number, optionCount: number, visibleOptionCount: number) {
  const halfWindow = Math.floor(visibleOptionCount / 2);
  const start = Math.min(
    Math.max(activeIndex - halfWindow, 0),
    Math.max(optionCount - visibleOptionCount, 0),
  );

  return {
    start,
    end: Math.min(start + visibleOptionCount, optionCount),
  };
}

export function ConfirmableSelect({
  options,
  value,
  defaultValue,
  visibleOptionCount = 6,
  isDisabled = false,
  onHighlightChange,
  onSubmit,
}: ConfirmableSelectProps) {
  const isControlled = value !== undefined;
  const [activeIndexState, setActiveIndexState] = useState(() => selectedIndexFor(options, value ?? defaultValue));
  const activeIndex = isControlled
    ? selectedIndexFor(options, value)
    : activeIndexState;
  const selectedValue = value ?? defaultValue;

  useEffect(() => {
    if (!isControlled) {
      setActiveIndexState(selectedIndexFor(options, defaultValue));
    }
  }, [defaultValue, isControlled, options]);

  function moveActiveIndex(nextIndex: number) {
    const normalizedIndex = ((nextIndex % options.length) + options.length) % options.length;
    const nextValue = options[normalizedIndex]?.value;

    if (!nextValue) {
      return;
    }

    if (!isControlled) {
      setActiveIndexState(normalizedIndex);
    }

    onHighlightChange?.(nextValue, normalizedIndex);
  }

  useInput((_input, key) => {
    if (isDisabled || options.length === 0) {
      return;
    }

    if (key.downArrow) {
      moveActiveIndex(activeIndex + 1);
      return;
    }

    if (key.upArrow) {
      moveActiveIndex(activeIndex - 1);
      return;
    }

    if (key.return) {
      onSubmit(options[activeIndex]?.value ?? options[0]?.value ?? '');
    }
  }, { isActive: !isDisabled });

  const { start, end } = useMemo(() => {
    return visibleRange(activeIndex, options.length, visibleOptionCount);
  }, [activeIndex, options.length, visibleOptionCount]);

  return (
    <Box flexDirection="column">
      {options.slice(start, end).map((option, offset) => {
        const index = start + offset;
        const isActive = index === activeIndex;
        const isSelected = option.value === selectedValue;

        return (
          <Box key={option.value}>
            <Box width={2}>
              <Text color={isActive ? 'white' : 'gray'}>{isActive ? '›' : ' '}</Text>
            </Box>
            <Box width={32}>
              <Text color={isActive ? 'blueBright' : 'gray'}>{option.label}</Text>
            </Box>
            {isSelected ? <Text color="green">✓</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
}
