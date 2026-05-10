import { describe, expect, it } from 'vitest';
import { createImageInputFromBytes } from './image-file-adapter';

describe('image-file-adapter', () => {
  it('creates runtime-neutral image input from bytes', async () => {
    const input = createImageInputFromBytes({
      bytes: new TextEncoder().encode('fake-image'),
      name: 'reference.png',
      type: 'image/png',
    });

    expect(input.name).toBe('reference.png');
    expect(input.type).toBe('image/png');
    expect(input.size).toBe(10);
    expect(Array.from(new Uint8Array(await input.arrayBuffer())))
      .toEqual(Array.from(new TextEncoder().encode('fake-image')));
  });
});
