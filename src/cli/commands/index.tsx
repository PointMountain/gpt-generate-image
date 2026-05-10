import process from 'node:process';
import React, { useEffect, useRef } from 'react';
import { TuiApp } from '../app/tui-app';
import { shouldUseInteractiveTerminal } from '../runtime/terminal-mode';

export default function IndexCommand() {
  const wroteFallbackRef = useRef(false);

  useEffect(() => {
    if (shouldUseInteractiveTerminal() || wroteFallbackRef.current) {
      return;
    }

    // 非交互环境下直接给出脚本入口，避免把 Ink TUI 混进管道或 CI。
    wroteFallbackRef.current = true;
    process.exitCode = 2;
    process.stderr.write('tokencanvas 需要交互式终端。请改用 `tokencanvas generate --prompt \"...\" --json`。\n');
  }, []);

  if (!shouldUseInteractiveTerminal()) {
    return null;
  }

  return <TuiApp />;
}
