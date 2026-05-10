import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

export interface SlashCommandDefinition {
  name: string;
  syntax: string;
  description: string;
}

interface CommandInputProps {
  commands: SlashCommandDefinition[];
  initialValue?: string;
  isDisabled?: boolean;
  onSubmit: (value: string) => void;
}

function commandPart(value: string) {
  return value.trimStart().split(/\s+/)[0] ?? '';
}

function commandRest(value: string) {
  const trimmed = value.trimStart();
  return trimmed.slice(commandPart(value).length);
}

function hasStartedArguments(value: string) {
  return /^\s*\/\S+\s/.test(value);
}

function rankCommandMatch(command: SlashCommandDefinition, query: string, keyword: string) {
  const commandName = command.name.toLowerCase();
  const description = command.description.toLowerCase();
  const syntax = command.syntax.toLowerCase();

  if (commandName.startsWith(query)) {
    return 0;
  }

  if (keyword && commandName.includes(keyword)) {
    return 1;
  }

  if (keyword && description.includes(keyword)) {
    return 2;
  }

  if (keyword && syntax.includes(keyword)) {
    return 3;
  }

  return Number.POSITIVE_INFINITY;
}

export function findCommandMatches(commands: SlashCommandDefinition[], value: string) {
  const query = commandPart(value);
  if (!query.startsWith('/') || hasStartedArguments(value)) {
    return [];
  }

  const normalizedQuery = query.toLowerCase();
  const keyword = normalizedQuery.slice(1);

  return commands
    .map((command, index) => ({
      command,
      index,
      rank: rankCommandMatch(command, normalizedQuery, keyword),
    }))
    .filter((match) => Number.isFinite(match.rank))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((match) => match.command)
    .slice(0, 8);
}

export function completeCommandValue(
  commands: SlashCommandDefinition[],
  value: string,
  activeIndex = 0,
) {
  const matches = findCommandMatches(commands, value);
  const activeCommand = matches[activeIndex] ?? matches[0];
  return activeCommand ? `${activeCommand.name} ` : value;
}

export function resolveSubmittedCommand(
  commands: SlashCommandDefinition[],
  value: string,
  activeIndex = 0,
) {
  const matches = findCommandMatches(commands, value);
  const activeCommand = matches[activeIndex] ?? matches[0];
  const command = commandPart(value);
  const rest = value.trimStart().slice(command.length);

  if (activeCommand && command !== activeCommand.name && !rest.trim()) {
    return activeCommand.name;
  }

  return value;
}

export function removeCurrentInputLine(value: string) {
  const lastLineStart = value.lastIndexOf('\n');
  return lastLineStart === -1 ? '' : value.slice(0, lastLineStart + 1);
}

function renderHighlightedCommand(name: string, query: string) {
  if (!query || !name.toLowerCase().startsWith(query.toLowerCase())) {
    return <Text color="gray">{name}</Text>;
  }

  return (
    <Text>
      <Text color="blueBright">{name.slice(0, query.length)}</Text>
      <Text color="gray">{name.slice(query.length)}</Text>
    </Text>
  );
}

function syntaxPlaceholder(command?: SlashCommandDefinition) {
  if (!command) {
    return '';
  }

  return command.syntax.replace(command.name, '').trim();
}

export function CommandInput({ commands, initialValue = '', isDisabled = false, onSubmit }: CommandInputProps) {
  const [value, setValue] = useState(initialValue);
  const [activeIndex, setActiveIndex] = useState(0);
  const { stdout } = useStdout();

  const matches = useMemo(() => {
    return findCommandMatches(commands, value);
  }, [commands, value]);

  const activeCommand = matches[activeIndex] ?? matches[0];
  const exactCommand = commands.find((command) => command.name === commandPart(value));
  const exactCommandPlaceholder = hasStartedArguments(value) && !commandRest(value).trim()
    ? syntaxPlaceholder(exactCommand)
    : '';
  const terminalWidth = Math.min(stdout.columns ?? 80, 120);
  const divider = '─'.repeat(Math.max(20, terminalWidth - 2));

  useEffect(() => {
    setActiveIndex(0);
  }, [value]);

  useInput((input, key) => {
    if (isDisabled) {
      return;
    }

    if (key.return && key.shift) {
      setValue((current) => `${current}\n`);
      return;
    }

    if (key.return) {
      onSubmit(resolveSubmittedCommand(commands, value, activeIndex));
      setValue('');
      return;
    }

    if (key.downArrow && matches.length) {
      setActiveIndex((current) => (current + 1) % matches.length);
      return;
    }

    if (key.upArrow && matches.length) {
      setActiveIndex((current) => (current - 1 + matches.length) % matches.length);
      return;
    }

    if (key.tab && activeCommand) {
      setValue(completeCommandValue(commands, value, activeIndex));
      return;
    }

    if ((key.meta && (key.backspace || key.delete)) || (key.ctrl && input === 'u')) {
      setValue(removeCurrentInputLine);
      return;
    }

    if (key.backspace || key.delete) {
      setValue((current) => current.slice(0, -1));
      return;
    }

    if (key.escape) {
      setValue('');
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setValue((current) => `${current}${input}`);
    }
  }, { isActive: !isDisabled });

  return (
    <Box flexDirection="column">
      <Text color="gray">{divider}</Text>
      <Box>
        <Text color="white">› </Text>
        <Text color={commandPart(value).startsWith('/') && exactCommand ? 'blueBright' : 'white'}>
          {value}
        </Text>
        {!isDisabled ? <Text color="white">█</Text> : null}
        {exactCommandPlaceholder ? <Text color="gray">{exactCommandPlaceholder}</Text> : null}
      </Box>
      <Text color="gray">{divider}</Text>

      {matches.length ? (
        <Box flexDirection="column" marginTop={1}>
          {matches.map((command, index) => (
            <Box key={command.name}>
              <Box width={28}>
                {index === activeIndex ? (
                  <Text color="blueBright">{command.name}</Text>
                ) : renderHighlightedCommand(command.name, commandPart(value))}
              </Box>
              <Text color={index === activeIndex ? 'blueBright' : 'gray'}>{command.description}</Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
