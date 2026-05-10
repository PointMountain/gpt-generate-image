import process from 'node:process';
import React, { useEffect, useState } from 'react';
import { Text } from 'ink';
import zod from 'zod';
import { option } from 'pastel';
import { startTokenCanvasWebServer } from '../web/static-server';

export const options = zod.object({
  host: zod.string().default('127.0.0.1').describe(option({
    description: 'Host for the local Web UI server',
    defaultValueDescription: '127.0.0.1',
  })),
  port: zod.number().int().min(1).max(65535).default(4174).describe(option({
    description: 'Port for the local Web UI server',
    defaultValueDescription: '4174',
  })),
  proxy: zod.boolean().default(false).describe(option({
    description: 'Enable local /api/openai proxy routes',
  })),
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function WebCommand({ options: commandOptions }: Props) {
  const [message, setMessage] = useState('正在启动 TokenCanvas Web UI...');

  useEffect(() => {
    let stopped = false;
    let closeServer: (() => Promise<void>) | undefined;

    void startTokenCanvasWebServer({
      host: commandOptions.host,
      port: commandOptions.port,
      enableProxy: commandOptions.proxy,
    }).then((server) => {
      closeServer = server.close;
      if (stopped) {
        void server.close();
        return;
      }

      setMessage(`TokenCanvas Web UI 已启动：${server.url}`);
    }).catch((error) => {
      if (stopped) {
        return;
      }

      process.exitCode = 1;
      setMessage(`TokenCanvas Web UI 启动失败：${error instanceof Error ? error.message : String(error)}`);
    });

    return () => {
      stopped = true;
      void closeServer?.();
    };
  }, [commandOptions.host, commandOptions.port, commandOptions.proxy]);

  return <Text>{message}</Text>;
}
