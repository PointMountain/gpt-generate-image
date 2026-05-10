import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { PreviewCapability } from './preview-capability';

export interface PreviewRenderResult {
  ok: boolean;
  output: string;
  protocol: PreviewCapability['protocol'];
}

export function renderPreviewFallback(filePath: string) {
  return `图片已保存：${filePath}`;
}

export function renderPreview(filePath: string, capability: PreviewCapability): PreviewRenderResult {
  if (!capability.supported) {
    return {
      ok: false,
      output: renderPreviewFallback(filePath),
      protocol: capability.protocol,
    };
  }

  if (capability.protocol === 'iterm2') {
    try {
      const name = Buffer.from(basename(filePath)).toString('base64');
      const contents = readFileSync(filePath).toString('base64');
      return {
        ok: true,
        output: `\u001B]1337;File=name=${name};inline=1;width=40;height=20;preserveAspectRatio=1:${contents}\u0007`,
        protocol: capability.protocol,
      };
    } catch {
      return {
        ok: false,
        output: `历史文件不存在：${filePath}`,
        protocol: capability.protocol,
      };
    }
  }

  return {
    ok: false,
    output: renderPreviewFallback(filePath),
    protocol: capability.protocol,
  };
}
