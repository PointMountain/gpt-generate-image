import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface SelectOption {
  label: string;
  value: string;
}

interface ConfirmableSelectProps {
  options: SelectOption[];
  defaultValue?: string;
  visibleOptionCount?: number;
  isDisabled?: boolean;
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
  defaultValue,
  visibleOptionCount = 6,
  isDisabled = false,
  onSubmit,
}: ConfirmableSelectProps) {
  const [activeIndex, setActiveIndex] = useState(() => selectedIndexFor(options, defaultValue));

  useEffect(() => {
    setActiveIndex(selectedIndexFor(options, defaultValue));
  }, [defaultValue, options]);

  useInput((_input, key) => {
    if (isDisabled || options.length === 0) {
      return;
    }

    if (key.downArrow) {
      setActiveIndex((current) => (current + 1) % options.length);
      return;
    }

    if (key.upArrow) {
      setActiveIndex((current) => (current - 1 + options.length) % options.length);
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
        const isSelected = option.value === defaultValue;

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
