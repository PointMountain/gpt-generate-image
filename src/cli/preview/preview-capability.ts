export type PreviewProtocol = 'iterm2' | 'kitty' | 'sixel' | 'none';

export interface PreviewCapability {
  supported: boolean;
  protocol: PreviewProtocol;
  reason?: string;
}

export function detectPreviewCapability(env: NodeJS.ProcessEnv = process.env): PreviewCapability {
  if (env.TOKENCANVAS_DISABLE_INLINE_PREVIEW === '1') {
    return {
      supported: false,
      protocol: 'none',
      reason: 'inline preview disabled',
    };
  }

  if (env.TERM_PROGRAM === 'iTerm.app') {
    return {
      supported: true,
      protocol: 'iterm2',
    };
  }

  if (env.KITTY_WINDOW_ID || env.TERM === 'xterm-kitty') {
    return {
      supported: true,
      protocol: 'kitty',
    };
  }

  if (env.TERM?.toLowerCase().includes('sixel')) {
    return {
      supported: true,
      protocol: 'sixel',
    };
  }

  return {
    supported: false,
    protocol: 'none',
    reason: 'terminal image protocol not detected',
  };
}
