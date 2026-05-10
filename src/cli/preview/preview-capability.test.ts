import { describe, expect, it } from 'vitest';
import { detectPreviewCapability } from './preview-capability';

describe('preview-capability', () => {
  it('detects iTerm2 and Kitty preview support from environment', () => {
    expect(detectPreviewCapability({ TERM_PROGRAM: 'iTerm.app' })).toMatchObject({
      supported: true,
      protocol: 'iterm2',
    });
    expect(detectPreviewCapability({ KITTY_WINDOW_ID: '1' })).toMatchObject({
      supported: true,
      protocol: 'kitty',
    });
  });

  it('allows inline preview to be disabled explicitly', () => {
    expect(detectPreviewCapability({
      TERM_PROGRAM: 'iTerm.app',
      TOKENCANVAS_DISABLE_INLINE_PREVIEW: '1',
    })).toMatchObject({
      supported: false,
      protocol: 'none',
    });
  });
});
