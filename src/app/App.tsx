import { useEffect, useRef, useState } from 'react';
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
  type GenerationFormState,
} from '../features/workbench/generation-form';
import { OpenAISettingsPanel } from '../features/settings/openai-settings-panel';
import type { HistoryEntry, PresetRecord, ResultImage } from '../features/history/history-types';
import { HistoryPanel } from '../features/history/history-panel';
import { PresetPanel } from '../features/presets/preset-panel';
import {
  createPreset,
  loadPresets,
  normalizePresetRecord,
  removePreset,
  savePresets,
  upsertPreset,
} from '../features/presets/preset-store';
import { deleteHistoryEntry, listHistoryEntries, putHistoryEntry } from '../lib/storage/indexeddb-history-store';
import { prependHistoryEntry } from '../features/history/history-store';
import {
  generateOpenAIImages,
  type ImageReferenceInput,
  type OpenAIImageSettings,
} from '../lib/openai/ai-sdk-image-client';
import {
  loadOpenAISettings,
  saveOpenAISettings,
  validateOpenAISettings,
  type OpenAISettingsStoreState,
  type OpenAISettingsValidationErrors,
} from '../lib/openai/openai-settings-store';
import {
  fetchOpenAIImageModels,
  type ImageModelCandidate,
  type ModelDiscoveryFailure,
} from '../lib/openai/model-discovery';

const MAX_REFERENCE_IMAGES = 16;

type ModelDiscoveryState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  models: ImageModelCandidate[];
  error?: ModelDiscoveryFailure | null;
  fetchedAt?: string;
};

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

function formFromSettings(settings: OpenAISettingsStoreState) {
  return createDefaultGenerationFormState({
    size: settings.defaultSize,
    quality: settings.defaultQuality,
    outputFormat: settings.defaultOutputFormat,
    background: settings.defaultBackground,
    outputCompression: settings.defaultOutputCompression,
  });
}

function createHistoryEntry(
  settings: OpenAIImageSettings,
  form: GenerationFormState,
  images: ResultImage[],
): HistoryEntry {
  return {
    id: createHistoryId(),
    modelId: settings.model,
    prompt: form.prompt,
    size: form.size,
    count: form.count,
    quality: form.quality,
    outputFormat: form.outputFormat,
    background: form.background,
    outputCompression: form.outputCompression,
    mode: form.mode,
    referencePreviewUrls: form.referenceImages.map((reference) => reference.previewUrl),
    maskPreviewUrl: form.maskPreviewUrl || undefined,
    images,
    createdAt: new Date().toISOString(),
  };
}

function revokeReferenceImages(references: ImageReferenceInput[]) {
  references.forEach((reference) => {
    if (reference.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(reference.previewUrl);
    }
  });
}

export function App() {
  const initialSettingsRef = useRef<OpenAISettingsStoreState | null>(null);
  if (!initialSettingsRef.current) {
    initialSettingsRef.current = loadOpenAISettings();
  }

  const [settings, setSettings] = useState<OpenAISettingsStoreState>(() => initialSettingsRef.current!);
  const [settingsErrors, setSettingsErrors] = useState<OpenAISettingsValidationErrors>({});
  const [modelDiscovery, setModelDiscovery] = useState<ModelDiscoveryState>({
    status: 'idle',
    models: [],
    error: null,
  });
  const [form, setForm] = useState<GenerationFormState>(() => formFromSettings(initialSettingsRef.current!));
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
  const generationAbortRef = useRef<AbortController | null>(null);
  const generationIdRef = useRef(0);
  const modelDiscoveryAbortRef = useRef<AbortController | null>(null);
  const modelDiscoveryRequestIdRef = useRef(0);
  const latestFormRef = useRef(form);

  useEffect(() => {
    latestFormRef.current = form;
  }, [form]);

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  useEffect(() => {
    let isMounted = true;

    void listHistoryEntries()
      .then((entries) => {
        if (isMounted) {
          setHistoryEntries(entries);
        }
      })
      .catch(() => {
        if (isMounted) {
          setToastMessage('历史记录加载失败，当前会话仍可继续。');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    return () => {
      const latestForm = latestFormRef.current;
      revokeReferenceImages(latestForm.referenceImages);
      if (latestForm.maskPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(latestForm.maskPreviewUrl);
      }
      generationAbortRef.current?.abort();
      modelDiscoveryAbortRef.current?.abort();
    };
  }, []);

  function handleSaveSettings() {
    const errors = validateOpenAISettings(settings);
    setSettingsErrors(errors);

    if (Object.keys(errors).length > 0) {
      setToastMessage('请先补全 OpenAI 设置。');
      return;
    }

    saveOpenAISettings(settings);
    setToastMessage(settings.hostedProxy ? '部署访问设置已保存到当前浏览器。' : 'OpenAI 设置已保存到当前浏览器。');
  }

  async function handleFetchModels() {
    const validationErrors = validateOpenAISettings(settings);
    setSettingsErrors(validationErrors);

    if (validationErrors.apiKey || validationErrors.proxyAccessToken || validationErrors.baseURL || validationErrors.timeoutSeconds) {
      setToastMessage(validationErrors.apiKey || validationErrors.proxyAccessToken || validationErrors.baseURL || validationErrors.timeoutSeconds || '请先修正 OpenAI 设置。');
      return;
    }

    modelDiscoveryAbortRef.current?.abort();
    const controller = new AbortController();
    modelDiscoveryAbortRef.current = controller;
    // 模型拉取允许用户在设置变化后立刻重试，因此这里用 requestId 丢弃过期响应。
    const requestId = ++modelDiscoveryRequestIdRef.current;

    setModelDiscovery((previous) => ({
      ...previous,
      status: 'loading',
      models: [],
      error: null,
      fetchedAt: undefined,
    }));

    const result = await fetchOpenAIImageModels(settings, {
      abortSignal: controller.signal,
    });
    if (requestId !== modelDiscoveryRequestIdRef.current) {
      return;
    }

    if (modelDiscoveryAbortRef.current === controller) {
      modelDiscoveryAbortRef.current = null;
    }

    if (!result.ok) {
      setModelDiscovery((previous) => ({
        ...previous,
        status: 'error',
        models: [],
        error: result,
        fetchedAt: undefined,
      }));
      setToastMessage(result.message);
      return;
    }

    setModelDiscovery({
      status: 'success',
      models: result.models,
      fetchedAt: result.fetchedAt,
      error: null,
    });
    setToastMessage(result.models.length ? `已发现 ${result.models.length} 个图片模型。` : '没有发现图片模型，可继续手动填写模型 ID。');
  }

  function handleSettingsChange(nextSettings: OpenAISettingsStoreState) {
    const shouldResetModelDiscovery = (
      settings.apiKey !== nextSettings.apiKey ||
      settings.proxyAccessToken !== nextSettings.proxyAccessToken ||
      settings.hostedProxy !== nextSettings.hostedProxy ||
      settings.baseURL !== nextSettings.baseURL
    );

    if (shouldResetModelDiscovery) {
      modelDiscoveryAbortRef.current?.abort();
      modelDiscoveryAbortRef.current = null;
      modelDiscoveryRequestIdRef.current += 1;
    }

    if (shouldResetModelDiscovery) {
      setModelDiscovery({
        status: 'idle',
        models: [],
        error: null,
        fetchedAt: undefined,
      });
    }

    setSettings(nextSettings);
  }

  function addReferenceFiles(files: File[]) {
    if (!files.length) {
      return;
    }

    setForm((previous) => {
      const availableSlots = MAX_REFERENCE_IMAGES - previous.referenceImages.length;
      const acceptedFiles = files.slice(0, Math.max(availableSlots, 0));
      const nextReferences = acceptedFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      if (files.length > acceptedFiles.length) {
        setToastMessage(`最多只能附加 ${MAX_REFERENCE_IMAGES} 张参考图。`);
      }

      return {
        ...previous,
        mode: previous.mode === 'text' ? 'image' : previous.mode,
        referenceImages: [...previous.referenceImages, ...nextReferences],
      };
    });
  }

  function removeReferenceImage(previewUrl: string) {
    setForm((previous) => {
      const removed = previous.referenceImages.find((reference) => reference.previewUrl === previewUrl);
      if (removed?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return {
        ...previous,
        referenceImages: previous.referenceImages.filter((reference) => reference.previewUrl !== previewUrl),
      };
    });
  }

  function setMaskFile(file: File | null) {
    setForm((previous) => {
      if (previous.maskPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previous.maskPreviewUrl);
      }

      if (!file) {
        return {
          ...previous,
          maskFile: null,
          maskPreviewUrl: '',
        };
      }

      return {
        ...previous,
        mode: 'mask',
        maskFile: file,
        maskPreviewUrl: URL.createObjectURL(file),
      };
    });
  }

  function clearForm() {
    revokeReferenceImages(form.referenceImages);
    if (form.maskPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(form.maskPreviewUrl);
    }
    setForm(formFromSettings(settings));
    setGenerationError(null);
  }

  function validateGenerationForm(nextForm: GenerationFormState) {
    if (settings.hostedProxy) {
      if (!settings.proxyAccessToken.trim()) {
        return '请先填写并保存部署访问 token。';
      }
    } else if (!settings.apiKey.trim()) {
      return '请先填写并保存 OpenAI API key。';
    }

    if (!settings.model.trim()) {
      return '请先填写 OpenAI 图片模型。';
    }

    if (!nextForm.prompt.trim()) {
      return '提示词还没写。';
    }

    if (nextForm.mode === 'image' && nextForm.referenceImages.length === 0) {
      return '图生图模式下至少需要一张参考图。';
    }

    if (nextForm.mode === 'mask' && nextForm.referenceImages.length === 0) {
      return '遮罩编辑需要至少一张源图。';
    }

    if (nextForm.mode === 'mask' && !nextForm.maskFile) {
      return '遮罩编辑需要上传 mask 文件。';
    }

    return '';
  }

  async function runGeneration(nextForm: GenerationFormState) {
    if (generationAbortRef.current) {
      setToastMessage('已有生成任务正在进行。');
      return;
    }

    const abortController = new AbortController();
    const generationId = generationIdRef.current + 1;
    generationIdRef.current = generationId;
    generationAbortRef.current = abortController;
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const result = await generateOpenAIImages(settings, nextForm, {
        abortSignal: abortController.signal,
      });

      if (generationIdRef.current !== generationId) {
        return;
      }

      if (!result.ok) {
        setGenerationError({
          message: result.message,
          detail: result.detail,
          recommendation: result.recommendation,
        });
        setToastMessage('生成失败，请检查 OpenAI 设置和本次输入。');
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

      const historyEntry = createHistoryEntry(settings, nextForm, nextResults);
      setHistoryEntries((previous) => prependHistoryEntry(previous, historyEntry));
      void putHistoryEntry(historyEntry).catch(() => {
        setToastMessage('图片已生成，但写入历史失败。');
      });

      setToastMessage(`生成完成，共得到 ${nextResults.length} 张图片。`);
    } catch (error) {
      if (generationIdRef.current === generationId) {
        setGenerationError({
          message: '生成流程意外中断。',
          detail: error instanceof Error ? error.message : String(error),
          recommendation: '请重新尝试；如果反复出现，请检查浏览器控制台或 OpenAI 设置。',
        });
        setToastMessage('生成失败，请检查 OpenAI 设置和本次输入。');
      }
    } finally {
      if (generationIdRef.current === generationId) {
        generationAbortRef.current = null;
        setIsGenerating(false);
      }
    }
  }

  async function handleGenerate() {
    const settingsValidationErrors = validateOpenAISettings(settings);
    setSettingsErrors(settingsValidationErrors);

    if (Object.keys(settingsValidationErrors).length > 0) {
      setToastMessage('请先完成 OpenAI 设置。');
      return;
    }

    const formError = validateGenerationForm(form);
    if (formError) {
      setToastMessage(formError);
      return;
    }

    await runGeneration(form);
  }

  function handleCancelGeneration() {
    generationAbortRef.current?.abort();
    generationIdRef.current += 1;
    generationAbortRef.current = null;
    setIsGenerating(false);
  }

  function applyHistoryEntryToEditor(entry: HistoryEntry) {
    setForm((previous) => ({
      ...previous,
      prompt: entry.prompt,
      size: entry.size,
      count: entry.count,
      quality: entry.quality,
      outputFormat: entry.outputFormat,
      background: entry.background,
      outputCompression: entry.outputCompression,
      // 历史里的 preview URL 可能是已失效的 blob URL；只恢复可直接再次发送的纯参数。
      mode: entry.mode === 'mask' ? 'image' : entry.mode,
      maskPreviewUrl: '',
      maskFile: null,
    }));
  }

  async function handleReuseImageAsReference(image: ResultImage) {
    try {
      const file = await convertImageToFile(image);
      addReferenceFiles([file]);
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
      size: form.size,
      count: form.count,
      quality: form.quality,
      outputFormat: form.outputFormat,
      background: form.background,
      outputCompression: form.outputCompression,
      mode: form.mode,
      modelId: settings.model,
    });

    setPresets((previous) => upsertPreset(previous, preset));
    setPresetDraftName('');
    setToastMessage('预设已保存。');
  }

  function applyPreset(preset: PresetRecord) {
    const normalizedPreset = normalizePresetRecord(preset);

    setForm((previous) => ({
      ...previous,
      prompt: normalizedPreset.prompt,
      size: normalizedPreset.size,
      count: normalizedPreset.count,
      quality: normalizedPreset.quality,
      outputFormat: normalizedPreset.outputFormat,
      background: normalizedPreset.background,
      outputCompression: normalizedPreset.outputCompression,
      mode: normalizedPreset.mode,
    }));

    setSettings((previous) => ({
      ...previous,
      model: normalizedPreset.modelId || previous.model,
    }));
  }

  const masthead = (
    <>
      <div className="masthead-brand">
        <p className="masthead-brand__eyebrow">OpenAI image studio</p>
        <h1>TokenCanvas</h1>
        <p>
          一个本地浏览器里的 OpenAI 图片创作工作台。选择模型、写提示词、附参考图、生成并把结果继续带回下一轮。
        </p>
      </div>

      <div className="masthead-meta">
        <span className="pill">OpenAI</span>
        <span className="pill pill--muted">
          {settings.model ? `模型：${settings.model}` : '等待填写模型'}
        </span>
        <span className="pill pill--muted">{settings.hostedProxy ? 'Cloudflare 代理' : `代理：${settings.useProxy ? 'on' : 'off'}`}</span>
      </div>
    </>
  );

  const commandBar = (
    <div className="studio-command-bar" aria-label="OpenAI 创作控制条">
      <div className="studio-command-bar__identity">
        <span className="studio-command-bar__mark">TC</span>
        <div>
          <p>Provider</p>
          <strong>OpenAI Image API</strong>
        </div>
      </div>
      <div className="studio-command-bar__metrics">
        <div>
          <span>模型</span>
          <strong>{settings.model || '未选择'}</strong>
        </div>
        <div>
          <span>模型列表</span>
          <strong>
            {modelDiscovery.status === 'loading'
              ? '拉取中'
              : modelDiscovery.status === 'success'
                ? `${modelDiscovery.models.length} 个候选`
                : modelDiscovery.status === 'error'
                  ? '拉取失败'
                  : '未拉取'}
          </strong>
        </div>
        <div>
          <span>连接</span>
          <strong>
            {settings.hostedProxy
              ? settings.proxyAccessToken ? `${settings.timeoutSeconds}s timeout` : '等待部署 token'
              : settings.apiKey ? `${settings.timeoutSeconds}s timeout` : '等待 API key'}
          </strong>
        </div>
        <div>
          <span>代理</span>
          <strong>{settings.hostedProxy ? 'hosted' : settings.useProxy ? 'on' : 'off'}</strong>
        </div>
      </div>
      <div className="studio-command-bar__actions">
        <button
          className="button button--ghost"
          type="button"
          disabled={(settings.hostedProxy ? !settings.proxyAccessToken.trim() : !settings.apiKey.trim()) || modelDiscovery.status === 'loading'}
          onClick={() => void handleFetchModels()}
        >
          {modelDiscovery.status === 'loading' ? '拉取中' : '拉取模型'}
        </button>
        <button className="button button--primary" type="button" onClick={handleSaveSettings}>
          保存设置
        </button>
      </div>
    </div>
  );

  const galleryStage = (
    <>
      <ResultGallery
        results={results}
        onPreview={setPreviewImage}
        onDownload={(image, index) => void downloadImage(image, index)}
        onUseAsReference={(image) => void handleReuseImageAsReference(image)}
        onReusePrompt={() => setToastMessage('当前编辑器已经保留这轮提示词，可直接继续改写。')}
      />

      {isGenerating ? (
        <div className="top-gap">
          <LoadingState
            title="正在生成图片"
            body="OpenAI 请求已经发出。保持页面开启等待返回，或取消本次请求后继续调整提示词。"
          />
          <div className="button-row top-gap">
            <button className="button button--ghost" type="button" onClick={handleCancelGeneration}>
              取消生成
            </button>
          </div>
        </div>
      ) : null}

      {generationError ? (
        <div className="section-card top-gap">
          <h3>这次生成没有成功</h3>
          <p>{generationError.message}</p>
          {generationError.recommendation ? (
            <p className="field__hint">{generationError.recommendation}</p>
          ) : null}
          <ErrorDetailDrawer summary="展开 OpenAI 返回详情" detail={generationError.detail} />
        </div>
      ) : null}
    </>
  );

  const composer = (
    <GenerationForm
      form={form}
      selectedModelLabel={settings.model}
      supportsReferenceImages
      canGenerate={Boolean((settings.hostedProxy ? settings.proxyAccessToken : settings.apiKey) && settings.model && form.prompt.trim())}
      isGenerating={isGenerating}
      onChangeForm={setForm}
      onGenerate={() => void handleGenerate()}
      onClear={clearForm}
      onAddReferenceFiles={addReferenceFiles}
      onRemoveReferenceImage={removeReferenceImage}
      onSelectMaskFile={setMaskFile}
    />
  );

  const rail = (
    <>
      <OpenAISettingsPanel
        settings={settings}
        errors={settingsErrors}
        modelDiscovery={modelDiscovery}
        onChange={handleSettingsChange}
        onSave={handleSaveSettings}
        onFetchModels={() => void handleFetchModels()}
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
    </>
  );

  return (
    <AppShell
      masthead={masthead}
      footer={<p>{settings.hostedProxy ? 'Cloudflare 托管模式。OpenAI API key 保存在 Worker secret 中；浏览器只保存部署访问 token。' : '本地个人工作台。OpenAI API key 仅保存在当前浏览器；公开部署请改用后端代理。'}</p>}
    >
      <WorkbenchFrame
        commandBar={commandBar}
        gallery={galleryStage}
        composer={composer}
        rail={rail}
      />

      <ToastRegion message={toastMessage} />
      <ResultPreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </AppShell>
  );
}
