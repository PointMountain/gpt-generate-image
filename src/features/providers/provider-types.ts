export type ResponseMode = 'auto' | 'base64' | 'url';

export interface ProviderFallbackConfig {
  enabled: boolean;
  useLocalProxy: boolean;
  skipDiscovery: boolean;
  manualModelId: string;
  imageEndpointOverride: string;
  extraHeadersText: string;
  extraQueryText: string;
  supportsReferenceImages: boolean;
  responseMode: ResponseMode;
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  preferredModel: string;
  fallback: ProviderFallbackConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderStoreState {
  providers: ProviderConfig[];
  activeProviderId: string | null;
}

export interface ModelOption {
  id: string;
  label: string;
  ownedBy?: string;
}

export interface DiscoveryState {
  status: 'idle' | 'loading' | 'success' | 'error';
  models: ModelOption[];
  likelyModelIds: string[];
  message?: string;
  detail?: string;
}

export interface ProviderValidationErrors {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
}
