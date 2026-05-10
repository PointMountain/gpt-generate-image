import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import WebCommand from './web';
import { startTokenCanvasWebServer, type TokenCanvasWebServer } from '../web/static-server';

vi.mock('../web/static-server', () => ({
  startTokenCanvasWebServer: vi.fn(),
}));

describe('web command', () => {
  it('closes the server when startup resolves after unmount', async () => {
    let resolveServer: (server: TokenCanvasWebServer) => void = () => {};
    const close = vi.fn(async () => {});
    vi.mocked(startTokenCanvasWebServer).mockReturnValue(new Promise((resolve) => {
      resolveServer = resolve;
    }));

    const app = render(<WebCommand options={{ host: '127.0.0.1', port: 4174, proxy: false }} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(startTokenCanvasWebServer).toHaveBeenCalledOnce();

    app.unmount();
    resolveServer({
      server: {} as TokenCanvasWebServer['server'],
      url: 'http://127.0.0.1:4174',
      close,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(close).toHaveBeenCalledOnce();
  });
});
