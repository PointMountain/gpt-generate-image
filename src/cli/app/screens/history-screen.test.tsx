import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import { HistoryScreen } from './history-screen';

describe('HistoryScreen', () => {
  it('renders terminal history output paths', () => {
    const { lastFrame } = render(
      <HistoryScreen
        entries={[{
          id: 'history-1',
          modelId: 'gpt-image-1',
          prompt: 'warm portrait',
          mode: 'text',
          size: '1024x1024',
          count: 1,
          quality: 'auto',
          outputFormat: 'png',
          background: 'auto',
          outputCompression: 0,
          outputFiles: [{ imageId: 'image-1', path: '/tmp/out.png', mimeType: 'image/png' }],
          createdAt: '2026-05-10T00:00:00.000Z',
        }]}
      />,
    );

    expect(lastFrame()).toContain('warm portrait');
    expect(lastFrame()).toContain('/tmp/out.png');
  });
});
