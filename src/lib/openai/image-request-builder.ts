import type { ProviderConfig } from '../../features/providers/provider-types';
import type { ResultImage } from '../../features/history/history-types';
import { getProviderRootUrl } from './model-discovery';
import { resolveProviderRequestUrl } from './local-proxy';

export interface ImageGenerationInput {
  prompt: string;
  negativePrompt: string;
  size: string;
  count: number;
  quality: string;
  outputFormat: string;
  mode: 'text' | 'reference';
  referenceFile: File | null;
  selectedModelId: string;
}

export interface BuiltImageRequest {
  url: string;
  init: RequestInit;
}

function parseLinePairs(text: string, separator: ':' | '=') {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, line) => {
      const [rawKey, ...rawValue] = line.split(separator);

      if (!rawKey || !rawValue.length) {
        return accumulator;
      }

      accumulator[rawKey.trim()] = rawValue.join(separator).trim();
      return accumulator;
    }, {});
}

function buildHeaders(provider: ProviderConfig, isMultipart: boolean) {
  const headers = new Headers({
    Authorization: `Bearer ${provider.apiKey}`,
    Accept: 'application/json',
  });

  if (!isMultipart) {
    headers.set('Content-Type', 'application/json');
  }

  const extraHeaders = parseLinePairs(provider.fallback.extraHeadersText, ':');
  Object.entries(extraHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return headers;
}

function appendExtraQueryParams(url: URL, provider: ProviderConfig) {
  provider.fallback.extraQueryText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        url.searchParams.set(key.trim(), valueParts.join('=').trim());
      }
    });
}

function resolveImageEndpoint(provider: ProviderConfig, mode: 'text' | 'reference') {
  const override = provider.fallback.imageEndpointOverride.trim();

  if (override) {
    if (/^https?:\/\//i.test(override)) {
      return override;
    }

    return `${trimTrailingSlash(getProviderRootUrl(provider.baseUrl))}/${override.replace(/^\/+/, '')}`;
  }

  const suffix = mode === 'reference' ? 'images/edits' : 'images/generations';
  return `${getProviderRootUrl(provider.baseUrl)}/${suffix}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function shouldSendValue(value: string) {
  return value.trim() !== '' && value !== 'auto';
}

function shouldSendCount(count: number) {
  return Number.isFinite(count) && count > 1;
}

export function buildImageRequest(
  provider: ProviderConfig,
  input: ImageGenerationInput,
): BuiltImageRequest {
  const isMultipart = input.mode === 'reference' && Boolean(input.referenceFile);
  const endpoint = new URL(resolveImageEndpoint(provider, input.mode));
  appendExtraQueryParams(endpoint, provider);

  if (isMultipart) {
    const body = new FormData();
    body.set('model', input.selectedModelId);
    body.set('prompt', input.prompt);

    if (shouldSendCount(input.count)) {
      body.set('n', String(input.count));
    }

    if (shouldSendValue(input.size)) {
      body.set('size', input.size);
    }

    if (shouldSendValue(input.quality)) {
      body.set('quality', input.quality);
    }

    if (shouldSendValue(input.outputFormat)) {
      body.set('output_format', input.outputFormat);
    }

    if (input.negativePrompt.trim()) {
      body.set('negative_prompt', input.negativePrompt);
    }

    if (input.referenceFile) {
      body.set('image', input.referenceFile);
    }

    return {
      url: resolveProviderRequestUrl(provider, endpoint.toString()),
      init: {
        method: 'POST',
        headers: buildHeaders(provider, true),
        body,
      },
    };
  }

  const responseMode = provider.fallback.responseMode === 'url' ? 'url' : 'b64_json';

  const payload: Record<string, unknown> = {
    model: input.selectedModelId,
    prompt: input.prompt,
    response_format: responseMode,
  };

  if (shouldSendCount(input.count)) {
    payload.n = input.count;
  }

  if (shouldSendValue(input.size)) {
    payload.size = input.size;
  }

  if (shouldSendValue(input.quality)) {
    payload.quality = input.quality;
  }

  if (input.negativePrompt.trim()) {
    payload.negative_prompt = input.negativePrompt;
  }

  if (shouldSendValue(input.outputFormat)) {
    payload.output_format = input.outputFormat;
  }

  return {
    url: resolveProviderRequestUrl(provider, endpoint.toString()),
    init: {
      method: 'POST',
      headers: buildHeaders(provider, false),
      body: JSON.stringify(payload),
    },
  };
}

export function buildResultFileName(image: ResultImage, index: number) {
  return image.fileName || `generated-image-${index + 1}.${image.extension ?? 'png'}`;
}
