export interface ImageBinaryInput {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface ImageReferenceInput {
  file: ImageBinaryInput;
  previewUrl: string;
}

export function createImageInputFromFile(file: ImageBinaryInput): ImageBinaryInput {
  return file;
}

export function createImageInputFromBytes(input: {
  bytes: Uint8Array;
  name: string;
  type: string;
}): ImageBinaryInput {
  const { bytes, name, type } = input;

  return {
    name,
    type,
    size: bytes.byteLength,
    arrayBuffer: async () => {
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      return buffer;
    },
  };
}
