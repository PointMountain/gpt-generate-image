import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '../components/layout/app-shell';
import { WorkbenchFrame } from '../components/layout/workbench-frame';
import { ToastRegion } from '../components/feedback/toast-region';
import { ErrorDetailDrawer } from '../components/status/error-detail-drawer';
import { LoadingState } from '../components/status/loading-state';
import { ResultPreviewModal } from '../features/results/result-preview-modal';
import { ResultGallery } from '../features/results/result-gallery';
import { downloadImage } from '../features/results/download-image';
import {
  GenerationForm,
  createDefaultGenerationFormState,
  isPristineGenerationForm,
  type GenerationFormState,
} from '../features/workbench/generation-form';
import { ProviderSettingsPanel } from '../features/providers/provider-settings-panel';
import {
  createEmptyProviderDraft,
  createProviderStoreState,
  duplicateProvider,
  getActiveProvider,
  removeProvider,
  setActiveProvider,
  upsertProvider,
} from '../features/providers/provider-store';
import type {
  DiscoveryState,
  ProviderConfig,
  ProviderStoreState,
  ProviderValidationErrors,
} from '../features/providers/provider-types';
import { validateProviderDraft } from '../lib/validation/provider-validation';
import { clearLocalConfigStore, loadProviderStore, saveProviderStore } from '../lib/storage/local-config-store';
import { generateImages, runModelDiscovery } from '../lib/openai/openai-compatible-client';
import { getBestDefaultModel, getProviderCapabilities } from '../lib/openai/provider-capabilities';
import { applyProfileDefaultsToProvider, resolveProviderProfile } from '../lib/openai/provider-profile';
import type { HistoryEntry, PresetRecord, ResultImage } from '../features/history/history-types';
import { HistoryPanel } from '../features/history/history-panel';
import { PresetPanel } from '../features/presets/preset-panel';
import { createPreset, loadPresets, removePreset, savePresets, upsertPreset } from '../features/presets/preset-store';
import { deleteHistoryEntry, listHistoryEntries, putHistoryEntry } from '../lib/storage/indexeddb-history-store';
import { prependHistoryEntry } from '../features/history/history-store';

function createDiscoveryState(): DiscoveryState {
  return {
    status: 'idle',
    models: [],
    likelyModelIds: [],
  };
}

function createHistoryId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `history-${Math.random().toString(36).slice(2, 10)}`;
}

async function convertImageToFile(image: ResultImage, suggestedName = 'reference-image.png') {
  const response = await fetch(image.src);
  const blob = await response.blob();

  return new File([blob], image.fileName ?? suggestedName, {
    type: image.mimeType ?? blob.type ?? 'image/png',
  });
}

function createHistoryEntry(
  provider: ProviderConfig,
  selectedModelId: string,
  form: GenerationFormState,
  images: ResultImage[],
): HistoryEntry {
  return {
    id: createHistoryId(),
    providerId: provider.id,
    providerLabel: provider.name,
    modelId: selectedModelId,
    prompt: form.prompt,
    negativePrompt: form.negativePrompt,
    size: form.size,
    count: form.count,
    quality: form.quality,
    mode: form.mode,
    referencePreviewUrl: form.referencePreviewUrl || undefined,
    images,
    createdAt: new Date().toISOString(),
  };
}

export function App() {
  const [providerState, setProviderState] = useState<ProviderStoreState>(() =>
    createProviderStoreState(loadProviderStore()),
  );
  const [providerDraft, setProviderDraft] = useState<ProviderConfig>(() => {
    const storedState = createProviderStoreState(loadProviderStore());
    return getActiveProvider(storedState) ?? createEmptyProviderDraft();
  });
  const [providerErrors, setProviderErrors] = useState<ProviderValidationErrors>({});
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>(createDiscoveryState);
  const [form, setForm] = useState<GenerationFormState>(createDefaultGenerationFormState);
  const [results, setResults] = useState<ResultImage[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [presets, setPresets] = useState<PresetRecord[]>(() => loadPresets());
  const [presetDraftName, setPresetDraftName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<{
    message: string;
    detail?: string;
    recommendation?: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<ResultImage | null>(null);
  const autoAppliedProfileRef = useRef<string>('');

  const selectedModelId = useMemo(
    () => getBestDefaultModel(providerDraft, discoveryState),
    [providerDraft, discoveryState],
  );
  const capabilities = useMemo(
    () => getProviderCapabilities(providerDraft, discoveryState),
    [providerDraft, discoveryState],
  );
  const providerProfile = useMemo(
    () => resolveProviderProfile(providerDraft),
    [providerDraft.baseUrl],
  );

  useEffect(() => {
    saveProviderStore(providerState);
  }, [providerState]);

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  useEffect(() => {
    void listHistoryEntries()
      .then(setHistoryEntries)
      .catch(() => {
        setToastMessage('历史记录加载失败，当前会话仍可继续。');
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    return () => {
      if (form.referencePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(form.referencePreviewUrl);
      }
    };
  }, [form.referencePreviewUrl]);

  useEffect(() => {
    const autoApplyKey = `${providerDraft.id}:${providerDraft.baseUrl}:${providerProfile.id}`;

    if (providerProfile.id === 'default' || autoAppliedProfileRef.current === autoApplyKey) {
      return;
    }

    autoAppliedProfileRef.current = autoApplyKey;
    setProviderDraft((previous) => applyProfileDefaultsToProvider(previous, providerProfile));
    setForm((previous) =>
      isPristineGenerationForm(previous)
        ? {
            ...previous,
            ...providerProfile.recommendedSettings,
          }
        : previous,
    );
    setToastMessage(`${providerProfile.label} 已套用推荐参数。`);
  }, [providerDraft.id, providerDraft.baseUrl, providerProfile]);

  function applyProviderProfileDefaults() {
    setProviderDraft((previous) => applyProfileDefaultsToProvider(previous, providerProfile));
    setForm((previous) => ({
      ...previous,
      ...providerProfile.recommendedSettings,
    }));
    setToastMessage(`${providerProfile.label} 推荐参数已应用。`);
  }

  async function discoverModelsForDraft() {
    const errors = validateProviderDraft(providerDraft);
    setProviderErrors(errors);

    if (Object.keys(errors).length > 0) {
      setToastMessage('先补全 provider 的基础字段，再测试连接。');
      return;
    }

    if (providerDraft.fallback.skipDiscovery) {
      setDiscoveryState({
        status: 'success',
        models: [],
        likelyModelIds: [],
        message: '已启用跳过模型发现，请直接手填模型。',
      });
      return;
    }

    setDiscoveryState({
      status: 'loading',
      models: [],
      likelyModelIds: [],
      message: '正在拉取模型列表…',
    });

    const result = await runModelDiscovery(providerDraft);
    setDiscoveryState(result);

    if (result.status === 'error') {
      setToastMessage('标准探测失败，可以直接展开兼容回退继续。');
    } else {
      setToastMessage(result.message ?? '模型已刷新。');
    }
  }

  function handleSaveProvider() {
    const errors = validateProviderDraft(providerDraft);
    setProviderErrors(errors);

    if (Object.keys(errors).length > 0) {
      setToastMessage('provider 还有未完成项，暂时无法保存。');
      return;
    }

    const nextState = upsertProvider(providerState, providerDraft);
    setProviderState(nextState);
    setToastMessage('provider 已保存到当前浏览器。');
  }

  function syncDraftWithActive(nextState: ProviderStoreState) {
    const nextActiveProvider = getActiveProvider(nextState);
    setProviderDraft(nextActiveProvider ?? createEmptyProviderDraft());
  }

  function handleSelectProvider(providerId: string) {
    const nextState = setActiveProvider(providerState, providerId);
    setProviderState(nextState);
    syncDraftWithActive(nextState);
    setGenerationError(null);
  }

  function handleDeleteProvider(providerId: string) {
    const nextState = removeProvider(providerState, providerId);
    setProviderState(nextState);
    syncDraftWithActive(nextState);
    if (!nextState.providers.length) {
      clearLocalConfigStore();
      setDiscoveryState(createDiscoveryState());
    }
  }

  function handleCreateNewProvider() {
    setProviderDraft(
      createEmptyProviderDraft({
        name: `Provider ${providerState.providers.length + 1}`,
      }),
    );
    setProviderErrors({});
    setDiscoveryState(createDiscoveryState());
  }

  function handleDuplicateProvider(provider: ProviderConfig) {
    setProviderDraft(duplicateProvider(provider));
    setProviderErrors({});
    setDiscoveryState(createDiscoveryState());
  }

  function setReferenceFile(file: File | null) {
    setForm((previous) => {
      if (previous.referencePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previous.referencePreviewUrl);
      }

      if (!file) {
        return {
          ...previous,
          referenceFile: null,
          referencePreviewUrl: '',
        };
      }

      return {
        ...previous,
        referenceFile: file,
        referencePreviewUrl: URL.createObjectURL(file),
      };
    });
  }

  function clearForm() {
    setReferenceFile(null);
    setForm(createDefaultGenerationFormState(providerProfile.recommendedSettings));
    setGenerationError(null);
  }

  async function runGeneration(
    provider: ProviderConfig,
    selectedModel: string,
    nextForm: GenerationFormState,
  ) {
    setIsGenerating(true);
    setGenerationError(null);

    const result = await generateImages(provider, {
      prompt: nextForm.prompt,
      negativePrompt: nextForm.negativePrompt,
      size: nextForm.size,
      count: nextForm.count,
      quality: nextForm.quality,
      outputFormat: nextForm.outputFormat,
      mode: nextForm.mode,
      referenceFile: nextForm.referenceFile,
      selectedModelId: selectedModel,
    });

    setIsGenerating(false);

    if (!result.ok) {
      setGenerationError({
        message: result.message,
        detail: result.detail,
        recommendation: result.recommendation,
      });
      setToastMessage('生成失败，可尝试切换模型或兼容回退。');
      return;
    }

    const nextResults: ResultImage[] = result.images.map((image) => ({
      id: image.id,
      src: image.src,
      source: image.source,
      mimeType: image.mimeType,
      fileName: image.fileName,
      extension: image.extension,
    }));

    setResults(nextResults);

    const historyEntry = createHistoryEntry(provider, selectedModel, nextForm, nextResults);
    setHistoryEntries((previous) => prependHistoryEntry(previous, historyEntry));
    void putHistoryEntry(historyEntry).catch(() => {
      setToastMessage('图片已生成，但写入历史失败。');
    });

    setToastMessage(`生成完成，共得到 ${nextResults.length} 张图片。`);
  }

  async function handleGenerate() {
    const errors = validateProviderDraft(providerDraft);
    setProviderErrors(errors);

    if (Object.keys(errors).length > 0) {
      setToastMessage('请先完成 provider 配置。');
      return;
    }

    if (!selectedModelId.trim()) {
      setToastMessage('先选择模型，或在兼容回退中手填模型。');
      return;
    }

    if (!form.prompt.trim()) {
      setToastMessage('提示词还没写。');
      return;
    }

    if (form.mode === 'reference' && !capabilities.canUseReferenceImages) {
      setToastMessage('当前 provider 被标记为不支持参考图。');
      return;
    }

    if (form.mode === 'reference' && !form.referenceFile) {
      setToastMessage('图生图模式下需要一张参考图。');
      return;
    }

    await runGeneration(providerDraft, selectedModelId, form);
  }

  function applyHistoryEntryToEditor(entry: HistoryEntry) {
    setForm((previous) => ({
      ...previous,
      prompt: entry.prompt,
      negativePrompt: entry.negativePrompt,
      size: entry.size,
      count: entry.count,
      quality: entry.quality,
      mode: entry.mode,
      referenceFile: null,
      referencePreviewUrl: entry.referencePreviewUrl ?? '',
    }));

    if (entry.providerId) {
      const matchingProvider = providerState.providers.find((provider) => provider.id === entry.providerId);
      if (matchingProvider) {
        const nextState = setActiveProvider(providerState, matchingProvider.id);
        setProviderState(nextState);
        setProviderDraft({
          ...matchingProvider,
          preferredModel: entry.modelId,
        });
      }
    }
  }

  async function handleReuseImageAsReference(image: ResultImage) {
    try {
      const file = await convertImageToFile(image);
      setReferenceFile(file);
      setForm((previous) => ({
        ...previous,
        mode: 'reference',
      }));
      setToastMessage('结果已装入参考图区。');
    } catch {
      setToastMessage('这张图暂时无法转成参考图。');
    }
  }

  async function handleDeleteHistory(entryId: string) {
    setHistoryEntries((previous) => previous.filter((entry) => entry.id !== entryId));
    await deleteHistoryEntry(entryId);
  }

  function handleSaveCurrentPreset() {
    if (!form.prompt.trim()) {
      setToastMessage('先填一段提示词，再保存预设。');
      return;
    }

    const preset = createPreset({
      name: presetDraftName.trim() || form.prompt.slice(0, 18),
      prompt: form.prompt,
      negativePrompt: form.negativePrompt,
      size: form.size,
      count: form.count,
      quality: form.quality,
      outputFormat: form.outputFormat,
      mode: form.mode,
      providerId: providerDraft.id || null,
      modelId: selectedModelId,
    });

    setPresets((previous) => upsertPreset(previous, preset));
    setPresetDraftName('');
    setToastMessage('预设已保存。');
  }

  function applyPreset(preset: PresetRecord) {
    setForm((previous) => ({
      ...previous,
      prompt: preset.prompt,
      negativePrompt: preset.negativePrompt,
      size: preset.size,
      count: preset.count,
      quality: preset.quality,
      outputFormat: preset.outputFormat,
      mode: preset.mode,
    }));

    if (preset.providerId) {
      const provider = providerState.providers.find((item) => item.id === preset.providerId);
      if (provider) {
        const nextState = setActiveProvider(providerState, provider.id);
        setProviderState(nextState);
        setProviderDraft({
          ...provider,
          preferredModel: preset.modelId,
        });
      }
    }
  }

  const masthead = (
    <>
      <div className="masthead-brand">
        <p className="masthead-brand__eyebrow">OpenAI-Compatible Image Workbench</p>
        <h1>AI 出图工作台</h1>
        <p>
          连接 OpenAI-compatible provider，拉取图片模型，发起生成并沉淀结果、历史和预设。
        </p>
      </div>

      <div className="masthead-meta">
        <span className="pill">{providerState.providers.length} 个 provider</span>
        <span className="pill pill--muted">
          {selectedModelId ? `模型：${selectedModelId}` : '等待选择模型'}
        </span>
      </div>
    </>
  );

  const lowerPanel = (
    <div className="bottom-grid">
      <ResultGallery
        results={results}
        onPreview={setPreviewImage}
        onDownload={(image, index) => void downloadImage(image, index)}
        onUseAsReference={(image) => void handleReuseImageAsReference(image)}
        onReusePrompt={() => setToastMessage('当前编辑器已经保留这轮提示词，可直接继续改写。')}
      />
      <HistoryPanel
        entries={historyEntries}
        onApply={applyHistoryEntryToEditor}
        onUseImageAsReference={(image) => void handleReuseImageAsReference(image)}
        onDelete={(entryId) => void handleDeleteHistory(entryId)}
      />
      <PresetPanel
        presets={presets}
        draftName={presetDraftName}
        canSaveCurrent={Boolean(form.prompt.trim())}
        onDraftNameChange={setPresetDraftName}
        onSaveCurrent={handleSaveCurrentPreset}
        onApply={applyPreset}
        onDelete={(presetId) => setPresets((previous) => removePreset(previous, presetId))}
      />
    </div>
  );

  return (
    <AppShell
      masthead={masthead}
      footer={<p>本地模式。key 仅保存在当前浏览器；若遇到 CORS，可继续使用本地代理或再包装桌面壳。</p>}
    >
      <WorkbenchFrame
        sidebar={
          <ProviderSettingsPanel
            providers={providerState.providers}
            activeProviderId={providerState.activeProviderId}
            draft={providerDraft}
            errors={providerErrors}
            discoveryState={discoveryState}
            profile={providerProfile}
            selectedModelId={selectedModelId}
            onSelectProvider={handleSelectProvider}
            onCreateNewProvider={handleCreateNewProvider}
            onDuplicateProvider={handleDuplicateProvider}
            onDeleteProvider={handleDeleteProvider}
            onDraftChange={setProviderDraft}
            onSaveProvider={handleSaveProvider}
            onDiscoverModels={() => void discoverModelsForDraft()}
            onSelectModel={(modelId) =>
              setProviderDraft((previous) => ({
                ...previous,
                preferredModel: modelId,
              }))
            }
            onApplyProfileDefaults={applyProviderProfileDefaults}
          />
        }
        lowerPanel={lowerPanel}
      >
        <GenerationForm
          form={form}
          selectedModelLabel={selectedModelId}
          supportsReferenceImages={capabilities.canUseReferenceImages}
          canGenerate={Boolean(providerDraft.apiKey && providerDraft.baseUrl && form.prompt.trim())}
          isGenerating={isGenerating}
          onChangeForm={setForm}
          onGenerate={() => void handleGenerate()}
          onClear={clearForm}
          onSelectReferenceFile={setReferenceFile}
        />

        {isGenerating ? (
          <div className="top-gap">
            <LoadingState
              title="正在生成图片"
              body="请求已经发出。若当前 provider 较慢，请保持页面开启并等待返回。"
            />
          </div>
        ) : null}

        {generationError ? (
          <div className="section-card top-gap">
            <h3>这次生成没有成功</h3>
            <p>{generationError.message}</p>
            {generationError.recommendation ? (
              <p className="field__hint">{generationError.recommendation}</p>
            ) : null}
            <ErrorDetailDrawer summary="展开 provider 返回详情" detail={generationError.detail} />
          </div>
        ) : null}
      </WorkbenchFrame>

      <ToastRegion message={toastMessage} />
      <ResultPreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </AppShell>
  );
}
