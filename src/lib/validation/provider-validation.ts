import type { ProviderConfig, ProviderValidationErrors } from '../../features/providers/provider-types';

function isLikelyHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export function validateProviderDraft(draft: ProviderConfig): ProviderValidationErrors {
  const errors: ProviderValidationErrors = {};

  if (!draft.name.trim()) {
    errors.name = '请给这个 provider 起一个便于识别的名字。';
  }

  if (!draft.baseUrl.trim()) {
    errors.baseUrl = 'baseURL 不能为空。';
  } else if (!isLikelyHttpUrl(draft.baseUrl)) {
    errors.baseUrl = 'baseURL 需要以 http:// 或 https:// 开头。';
  }

  if (!draft.apiKey.trim()) {
    errors.apiKey = 'apiKey 不能为空。';
  }

  return errors;
}
