import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppShell } from '../components/layout/app-shell';
import { WorkbenchFrame } from '../components/layout/workbench-frame';
import { ToastRegion } from '../components/feedback/toast-region';
import { ErrorDetailDrawer } from '../components/status/error-detail-drawer';
import { LoadingState } from '../components/status/loading-state';
import { ResultPreviewModal } from '../features/results/result-preview-modal';
import { GuideVideoModal } from '../features/onboarding/guide-video-modal';
import { ResultGallery } from '../features/results/result-gallery';
import { downloadImage } from '../features/results/download-image';
import {
  GenerationForm,
  createDefaultGenerationFormState,
  isPristineGenerationForm,
  type GenerationFormState,
} from '../features/workbench/generation-form';
import { OpenAISettingsPanel } from '../features/settings/openai-settings-panel';
import type { HistoryEntry, PresetRecord, ResultImage } from '../features/history/history-types';
import { HistoryPanel } from '../features/history/history-panel';
import {
  restoreHistoryInputFile,
  serializeHistoryInputFile,
} from '../features/history/history-input-material';
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
import { normalizeBrowserGeneratedImages } from '../lib/openai/browser-output-normalizer';
import {
  BrowserMaskInputNormalizationError,
  normalizeBrowserMaskInputs,
} from '../lib/openai/browser-mask-input-normalizer';
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
import { normalizeOpenAIBaseURL } from '../lib/openai/openai-endpoint';
import { DEFAULT_IMAGE_MODEL } from '../lib/openai/openai-option-sets';

const MAX_REFERENCE_IMAGES = 16;

type ModelDiscoveryState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  models: ImageModelCandidate[];
  error?: ModelDiscoveryFailure | null;
  fetchedAt?: string;
};

type WorkbenchView = 'create' | 'library';
type MobileDestination = 'current' | 'create' | 'recipes' | 'history';

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

function formMatchesCurrentDefaults(form: GenerationFormState, settings: OpenAISettingsStoreState) {
  const defaults = formFromSettings(settings);

  return isPristineGenerationForm(form) || (
    form.prompt === defaults.prompt &&
    form.size === defaults.size &&
    form.count === defaults.count &&
    form.quality === defaults.quality &&
    form.outputFormat === defaults.outputFormat &&
    form.background === defaults.background &&
    form.outputCompression === defaults.outputCompression &&
    form.mode === defaults.mode &&
    form.referenceImages.length === 0 &&
    form.maskFile === null &&
    form.maskPreviewUrl === ''
  );
}

async function createHistoryEntry(
  settings: OpenAIImageSettings,
  form: GenerationFormState,
  images: ResultImage[],
): Promise<HistoryEntry> {
  const storedReferences = await Promise.allSettled(
    form.referenceImages.map((reference) => serializeHistoryInputFile(reference.file)),
  );
  const referenceImages = storedReferences.flatMap((result) => (
    result.status === 'fulfilled' ? [result.value] : []
  ));
  const maskImage = form.maskFile
    ? await serializeHistoryInputFile(form.maskFile).catch(() => undefined)
    : undefined;

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
    referenceImages,
    maskImage,
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
  const [activeView, setActiveView] = useState<WorkbenchView>('create');
  const [mobileDestination, setMobileDestination] = useState<MobileDestination>('create');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideVideoOpen, setIsGuideVideoOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const generationAbortRef = useRef<AbortController | null>(null);
  const generationIdRef = useRef(0);
  const modelDiscoveryAbortRef = useRef<AbortController | null>(null);
  const modelDiscoveryRequestIdRef = useRef(0);
  const latestFormRef = useRef(form);
  const composerRegionRef = useRef<HTMLDivElement | null>(null);
  const canvasRegionRef = useRef<HTMLDivElement | null>(null);
  const settingsDrawerRef = useRef<HTMLElement | null>(null);
  const settingsReturnFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const canControlScrollRestoration = 'scrollRestoration' in window.history;
    const previousScrollRestoration = canControlScrollRestoration ? window.history.scrollRestoration : undefined;

    if (canControlScrollRestoration) {
      window.history.scrollRestoration = 'manual';
    }

    window.scrollTo(0, 0);

    return () => {
      if (canControlScrollRestoration && previousScrollRestoration) {
        window.history.scrollRestoration = previousScrollRestoration;
      }
    };
  }, []);

  useEffect(() => {
    latestFormRef.current = form;
  }, [form]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleDrawerKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !settingsDrawerRef.current) {
        return;
      }

      const focusable = Array.from(settingsDrawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => {
        const closedDetails = element.closest<HTMLDetailsElement>('details:not([open])');
        const isClosedDetailsSummary = closedDetails?.querySelector(':scope > summary') === element;

        return (
          (!closedDetails || isClosedDetailsSummary) &&
          !element.hasAttribute('hidden') &&
          element.getClientRects().length > 0 &&
          window.getComputedStyle(element).visibility !== 'hidden'
        );
      });
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleDrawerKeyDown);
    return () => {
      window.removeEventListener('keydown', handleDrawerKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      settingsReturnFocusRef.current?.focus();
    };
  }, [isSettingsOpen]);

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
      setToastMessage('请先补全连接设置。');
      return;
    }

    const shouldApplyDefaults = formMatchesCurrentDefaults(form, initialSettingsRef.current ?? settings);
    const normalizedSettings = {
      ...settings,
      baseURL: normalizeOpenAIBaseURL(settings.baseURL),
      needsReconfiguration: false,
    };

    saveOpenAISettings(normalizedSettings);
    setSettings(normalizedSettings);
    initialSettingsRef.current = normalizedSettings;
    if (shouldApplyDefaults) {
      setForm(formFromSettings(normalizedSettings));
    }
    setToastMessage('连接设置已保存在当前浏览器。');
  }

  async function handleFetchModels() {
    const validationErrors = validateOpenAISettings(settings);
    setSettingsErrors(validationErrors);

    if (validationErrors.apiKey || validationErrors.baseURL || validationErrors.timeoutSeconds) {
      setToastMessage(validationErrors.apiKey || validationErrors.baseURL || validationErrors.timeoutSeconds || '请先修正连接设置。');
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
    const preferredModel = result.models.find((model) => model.id === DEFAULT_IMAGE_MODEL)?.id;
    const shouldSelectPreferredModel = !settings.model.trim() && Boolean(preferredModel);

    if (shouldSelectPreferredModel && preferredModel) {
      setSettings((previous) => ({
        ...previous,
        model: preferredModel,
      }));
      setSettingsErrors((previous) => ({
        ...previous,
        model: undefined,
      }));
    }

    setToastMessage(
      shouldSelectPreferredModel
        ? `已发现 ${result.models.length} 个图片模型，已选择 ${DEFAULT_IMAGE_MODEL}。`
        : result.models.length
          ? `已发现 ${result.models.length} 个图片模型。`
          : '没有发现图片模型，可继续手动填写模型 ID。',
    );
  }

  function handleSettingsChange(nextSettings: OpenAISettingsStoreState) {
    const shouldResetModelDiscovery = (
      settings.apiKey !== nextSettings.apiKey ||
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
        setToastMessage(`最多只能添加 ${MAX_REFERENCE_IMAGES} 张输入素材。`);
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
    if (!settings.apiKey.trim()) {
      return '请先填写并保存 OpenAI API key。';
    }

    if (!settings.model.trim()) {
      return '请先填写 OpenAI 图片模型。';
    }

    if (!nextForm.prompt.trim()) {
      return '提示词还没写。';
    }

    if (nextForm.mode === 'image' && nextForm.referenceImages.length === 0) {
      return '图生图模式下至少需要一张输入素材。';
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
      const normalizedMaskInputs = nextForm.mode === 'mask'
        ? await normalizeBrowserMaskInputs(
          nextForm.referenceImages,
          nextForm.maskFile,
          nextForm.size,
          nextForm.background,
        )
        : undefined;
      if (generationIdRef.current !== generationId) {
        return;
      }
      const requestForm = normalizedMaskInputs ? {
        ...nextForm,
        referenceImages: normalizedMaskInputs.referenceImages,
        maskFile: normalizedMaskInputs.maskFile,
      } : nextForm;
      const result = await generateOpenAIImages(settings, requestForm, {
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
        setToastMessage('生成失败，请检查连接设置和本次输入。');
        return;
      }

      const normalizedImages = await normalizeBrowserGeneratedImages(result.images, {
        size: nextForm.size,
        outputFormat: nextForm.outputFormat,
        outputCompression: nextForm.outputCompression,
        background: nextForm.background,
      });
      if (generationIdRef.current !== generationId) {
        return;
      }
      const nextResults: ResultImage[] = normalizedImages.map((image) => ({
        id: image.id,
        src: image.src,
        source: image.source,
        mimeType: image.mimeType,
        fileName: image.fileName,
        extension: image.extension,
        width: image.width,
        height: image.height,
        dimensionStatus: image.dimensionStatus,
      }));

      const historyEntry = await createHistoryEntry(settings, nextForm, nextResults);
      if (generationIdRef.current !== generationId) {
        return;
      }
      setResults(nextResults);
      setHistoryEntries((previous) => prependHistoryEntry(previous, historyEntry));
      void putHistoryEntry(historyEntry).catch(() => {
        setToastMessage('图片已生成，但写入历史失败。');
      });

      if (nextResults.some((image) => image.dimensionStatus === 'mismatched')) {
        setToastMessage(`生成完成，共得到 ${nextResults.length} 张图片；当前端点未遵守请求比例，已保留原图。`);
      } else if (nextResults.some((image) => image.dimensionStatus === 'resized')) {
        setToastMessage(`生成完成，共得到 ${nextResults.length} 张图片；已在本地调整为请求尺寸。`);
      } else {
        setToastMessage(`生成完成，共得到 ${nextResults.length} 张图片。`);
      }
    } catch (error) {
      if (generationIdRef.current === generationId) {
        setGenerationError({
          message: error instanceof BrowserMaskInputNormalizationError
            ? '遮罩输入无法适配到请求画布。'
            : '生成流程意外中断。',
          detail: error instanceof Error ? error.message : String(error),
          recommendation: error instanceof BrowserMaskInputNormalizationError
            ? '请确认源图和 mask 尺寸一致，并使用浏览器可读取的 PNG、JPEG 或 WebP 文件。'
            : '请重新尝试；如果反复出现，请检查浏览器控制台或连接设置。',
        });
        setToastMessage('生成失败，请检查连接设置和本次输入。');
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
      setToastMessage('请先完成连接设置。');
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
    setToastMessage('已取消本次创作轮次。');
  }

  async function applyHistoryEntryToEditor(entry: HistoryEntry) {
    const durableReferences = entry.referenceImages ?? [];
    const restoredReferences = durableReferences.flatMap((input) => {
      try {
        const file = restoreHistoryInputFile(input);
        return [{ file, previewUrl: URL.createObjectURL(file) }];
      } catch {
        return [];
      }
    });

    if (!durableReferences.length && entry.referencePreviewUrls?.length) {
      const legacyReferences = await Promise.allSettled(
        entry.referencePreviewUrls.map(async (previewUrl, index) => {
          const response = await fetch(previewUrl);
          if (!response.ok && !previewUrl.startsWith('blob:') && !previewUrl.startsWith('data:')) {
            throw new Error('历史输入素材已不可用。');
          }
          const blob = await response.blob();
          const file = new File([blob], `history-input-${index + 1}`, {
            type: blob.type || 'application/octet-stream',
          });
          return { file, previewUrl: URL.createObjectURL(file) };
        }),
      );
      restoredReferences.push(...legacyReferences.flatMap((result) => (
        result.status === 'fulfilled' ? [result.value] : []
      )));
    }

    let restoredMask: { file: File; previewUrl: string } | null = null;
    if (entry.maskImage) {
      try {
        const file = restoreHistoryInputFile(entry.maskImage);
        restoredMask = { file, previewUrl: URL.createObjectURL(file) };
      } catch {
        restoredMask = null;
      }
    }

    setForm((previous) => {
      revokeReferenceImages(previous.referenceImages);
      if (previous.maskPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previous.maskPreviewUrl);
      }

      return {
        ...previous,
        prompt: entry.prompt,
        size: entry.size,
        count: entry.count,
        quality: entry.quality,
        outputFormat: entry.outputFormat,
        background: entry.background,
        outputCompression: entry.outputCompression,
        mode: entry.mode === 'text' ? 'text' : entry.mode === 'mask' && restoredMask ? 'mask' : 'image',
        referenceImages: restoredReferences,
        maskPreviewUrl: restoredMask?.previewUrl ?? '',
        maskFile: restoredMask?.file ?? null,
      };
    });

    if (entry.mode === 'text') {
      setToastMessage('已恢复创作配方。');
    } else if (restoredReferences.length) {
      setToastMessage(
        restoredMask
          ? `已恢复创作配方、${restoredReferences.length} 张输入素材和 mask。`
          : `已恢复创作配方和 ${restoredReferences.length} 张输入素材。`,
      );
    } else {
      setToastMessage('创作配方已恢复，原输入素材已不可用，请重新添加。');
    }
  }

  async function handleReuseImageAsReference(image: ResultImage) {
    try {
      const file = await convertImageToFile(image);
      addReferenceFiles([file]);
      setToastMessage('结果已加入输入素材。');
    } catch {
      setToastMessage('这张图暂时无法加入输入素材。');
    }
  }

  async function handleDownloadResult(image: ResultImage, index: number) {
    try {
      await downloadImage(image, index);
      setToastMessage('图片下载已开始。');
    } catch {
      setToastMessage('图片下载失败，请稍后重试。');
    }
  }

  async function handleDeleteHistory(entryId: string) {
    setHistoryEntries((previous) => previous.filter((entry) => entry.id !== entryId));
    await deleteHistoryEntry(entryId);
  }

  function handleSaveCurrentPreset() {
    if (!form.prompt.trim()) {
      setToastMessage('先填一段画面描述，再保存创作配方。');
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
    setToastMessage('创作配方已保存。');
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

  const canGenerate = Boolean(settings.apiKey && settings.model && form.prompt.trim());
  const connectionReady = Boolean(settings.apiKey.trim() && settings.model.trim());

  function showCreateView() {
    setActiveView('create');
    setMobileDestination('create');
  }

  function showLibraryView(destination: MobileDestination = 'recipes') {
    setActiveView('library');
    setMobileDestination(destination);
  }

  function focusPromptEditor() {
    showCreateView();
    window.setTimeout(() => document.getElementById('prompt-textarea')?.focus(), 0);
  }

  function openSettings() {
    settingsReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setIsSettingsOpen(true);
  }

  function selectMobileDestination(destination: MobileDestination) {
    setMobileDestination(destination);
    if (destination === 'recipes' || destination === 'history') {
      setActiveView('library');
    } else {
      setActiveView('create');
    }

    window.setTimeout(() => {
      if (destination === 'create' || destination === 'recipes') {
        composerRegionRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      } else {
        canvasRegionRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      }
    }, 0);
  }

  const brandRail = (
    <div className="brand-rail">
      <div className="brand-rail__identity">
        <img src="/tokencanvas-hero.png" alt="造境卡通标志" />
        <h1>造境</h1>
        <p>一句成画，万象由心</p>
      </div>

      <nav className="brand-rail__navigation" aria-label="主导航">
        <button
          type="button"
          className={activeView === 'create' ? 'is-active' : ''}
          aria-current={activeView === 'create' ? 'page' : undefined}
          onClick={showCreateView}
        >
          创作
        </button>
        <button
          type="button"
          className={activeView === 'library' ? 'is-active' : ''}
          aria-current={activeView === 'library' ? 'page' : undefined}
          onClick={() => showLibraryView()}
        >
          配方
        </button>
      </nav>

      <div className="brand-rail__connection">
        <div>
          <span className={connectionReady ? 'status-dot is-ready' : 'status-dot'} aria-hidden="true" />
          <strong>{connectionReady ? '连接已配置' : '等待连接'}</strong>
        </div>
        <p>{settings.model || '尚未选择模型'}</p>
        <button type="button" onClick={openSettings} aria-label="连接设置">
          <span>连接设置</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );

  const composer = (
    <div ref={composerRegionRef} className="workbench-composer">
      {activeView === 'create' ? (
        <GenerationForm
          form={form}
          selectedModelLabel={settings.model}
          supportsReferenceImages
          canGenerate={canGenerate}
          isGenerating={isGenerating}
          onChangeForm={setForm}
          onGenerate={() => void handleGenerate()}
          onClear={clearForm}
          onAddReferenceFiles={addReferenceFiles}
          onRemoveReferenceImage={removeReferenceImage}
          onSelectMaskFile={setMaskFile}
        />
      ) : (
        <PresetPanel
          presets={presets}
          draftName={presetDraftName}
          canSaveCurrent={Boolean(form.prompt.trim())}
          onDraftNameChange={setPresetDraftName}
          onSaveCurrent={handleSaveCurrentPreset}
          onApply={(preset) => {
            applyPreset(preset);
            showCreateView();
          }}
          onDelete={(presetId) => setPresets((previous) => removePreset(previous, presetId))}
        />
      )}
    </div>
  );

  const emptyCanvas = showGuide ? (
    <section className="welcome-canvas" aria-labelledby="welcome-canvas-heading">
      <div className="welcome-canvas__hero">
        <span className="welcome-canvas__tape" aria-hidden="true" />
        <h2 id="welcome-canvas-heading">从一句话开始，<br />把画面做出来。</h2>
      </div>
      <p className="welcome-canvas__intro">
        完成连接、写下创作配方，然后让第一张图片落到结果画布。高级参数会在需要时出现。
      </p>

      <button
        className="guide-video-card"
        type="button"
        onClick={() => setIsGuideVideoOpen(true)}
        aria-label="观看 1 分 17 秒使用指南"
      >
        <span className="guide-video-card__media" aria-hidden="true">
          <img
            src="/tokencanvas-guide-poster.webp"
            alt=""
            width="1280"
            height="720"
          />
          <span className="guide-video-card__play">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13l10-6.5z" />
            </svg>
          </span>
          <span className="guide-video-card__duration">01:17</span>
        </span>
        <span className="guide-video-card__copy">
          <small>第一次使用？</small>
          <strong>1 分 17 秒看懂 API key 和图片生成</strong>
          <span>注册账号 → 创建密钥 → 回到造境连接模型</span>
          <em>开始观看 →</em>
        </span>
      </button>

      <section className="welcome-guide" aria-labelledby="welcome-guide-heading">
        <header>
          <h3 id="welcome-guide-heading">三步开始创作</h3>
          <button type="button" onClick={() => setShowGuide(false)} aria-label="暂时隐藏引导">
            暂时隐藏 ×
          </button>
        </header>
        <ol>
          <li>
            <button type="button" onClick={openSettings}>
              <span className="welcome-guide__number">01</span>
              <span>
                <strong>连接模型</strong>
                <small>检查密钥与模型配置</small>
              </span>
              <em className={connectionReady ? 'is-ready' : ''}>{connectionReady ? '已填写' : '去连接'}</em>
            </button>
          </li>
          <li>
            <button type="button" onClick={focusPromptEditor}>
              <span className="welcome-guide__number">02</span>
              <span>
                <strong>写好配方</strong>
                <small>补全画面描述和关键参数</small>
              </span>
              <em className={form.prompt.trim() ? 'is-ready' : ''}>{form.prompt.trim() ? '已完成' : '去填写'}</em>
            </button>
          </li>
          <li>
            <button type="button" onClick={canGenerate ? () => void handleGenerate() : focusPromptEditor}>
              <span className="welcome-guide__number">03</span>
              <span>
                <strong>开始生成</strong>
                <small>确认后才会发起创作轮次</small>
              </span>
              <em>{canGenerate ? '下一步' : '待完成'}</em>
            </button>
          </li>
        </ol>
      </section>
    </section>
  ) : (
    <section className="welcome-canvas welcome-canvas--hidden">
      <div className="welcome-canvas__hero">
        <h2>画布准备好了。</h2>
      </div>
      <p>写好创作配方后，第一张结果会出现在这里。</p>
      <button className="button button--ghost" type="button" onClick={() => setShowGuide(true)}>
        打开创作引导
      </button>
    </section>
  );

  const resultCanvas = (
    <>
      {results.length ? (
        <ResultGallery
          results={results}
          onPreview={setPreviewImage}
          onDownload={(image, index) => void handleDownloadResult(image, index)}
          onUseAsReference={(image) => void handleReuseImageAsReference(image)}
        />
      ) : emptyCanvas}

      {isGenerating ? (
        <div className="top-gap">
          <LoadingState
            title="正在生成图片"
            body="创作轮次已经发出。保持页面开启等待返回，也可以取消后继续调整创作配方。"
          />
          <div className="button-row top-gap">
            <button className="button button--ghost" type="button" onClick={handleCancelGeneration}>
              取消生成
            </button>
          </div>
        </div>
      ) : null}

      {generationError ? (
        <div className="section-card generation-error top-gap">
          <h3>这次创作没有成功</h3>
          <p>{generationError.message}</p>
          {generationError.recommendation ? (
            <p className="field__hint">{generationError.recommendation}</p>
          ) : null}
          <ErrorDetailDrawer summary="展开模型返回详情" detail={generationError.detail} />
        </div>
      ) : null}
    </>
  );

  const canvas = (
    <div className="canvas-shell">
      <div className="canvas-shell__toolbar">
        <div className="canvas-shell__tabs">
          <button
            type="button"
            className={activeView === 'create' ? 'is-active' : ''}
            onClick={showCreateView}
          >
            当前
          </button>
          <button
            type="button"
            className={activeView === 'library' ? 'is-active' : ''}
            onClick={() => showLibraryView('history')}
          >
            历史 <span>{historyEntries.length}</span>
          </button>
        </div>
        <div className="canvas-shell__tools">
          <button
            type="button"
            className="guide-badge"
            onClick={() => setIsGuideVideoOpen(true)}
            aria-label="打开使用指南"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>
            使用指南
          </button>
          <button
            type="button"
            className="model-badge"
            onClick={openSettings}
            aria-label="打开模型连接设置"
          >
            <span aria-hidden="true" />
            {settings.model || '选择模型'}
          </button>
        </div>
      </div>

      <div ref={canvasRegionRef} className="canvas-shell__content">
        {activeView === 'create' ? resultCanvas : (
          <HistoryPanel
            entries={historyEntries}
            onApply={(entry) => {
              void applyHistoryEntryToEditor(entry);
              showCreateView();
            }}
            onUseImageAsReference={(image) => void handleReuseImageAsReference(image)}
            onDownload={(image, index) => void handleDownloadResult(image, index)}
            onDelete={(entryId) => void handleDeleteHistory(entryId)}
          />
        )}
      </div>
    </div>
  );

  const mobileHeader = (
    <div className="mobile-app-header">
      <strong>造境</strong>
      <div className="mobile-app-header__actions">
        <button
          type="button"
          className="guide-badge"
          onClick={() => setIsGuideVideoOpen(true)}
          aria-label="打开使用指南"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>
          指南
        </button>
        <button
          type="button"
          className="mobile-model-badge"
          onClick={openSettings}
          aria-label="打开模型连接设置"
        >
          <span aria-hidden="true" />
          {settings.model || '选择模型'}
        </button>
      </div>
    </div>
  );

  const mobileNavigation = (
    <>
      {([
        ['current', '当前'],
        ['create', '创作'],
        ['recipes', '配方'],
        ['history', '历史'],
      ] as const).map(([destination, label]) => (
        <button
          key={destination}
          type="button"
          className={mobileDestination === destination ? 'is-active' : ''}
          aria-current={mobileDestination === destination ? 'page' : undefined}
          onClick={() => selectMobileDestination(destination)}
        >
          {label}
        </button>
      ))}
    </>
  );

  const settingsDrawer = isSettingsOpen ? (
    <div className="settings-drawer-layer">
      <button
        type="button"
        className="settings-drawer-layer__scrim"
        aria-label="关闭连接设置遮罩"
        onClick={() => setIsSettingsOpen(false)}
      />
      <aside
        ref={settingsDrawerRef}
        className="settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-drawer-heading"
      >
        <header className="settings-drawer__header">
          <div>
            <p>模型连接</p>
            <h2 id="settings-drawer-heading">连接图像模型</h2>
          </div>
          <button type="button" autoFocus onClick={() => setIsSettingsOpen(false)} aria-label="关闭连接设置">
            ×
          </button>
        </header>
        <div className="settings-drawer__body">
          <div className="settings-drawer__privacy">
            API key 只保存在这台设备，不会写入创作历史或创作配方。
          </div>
          <OpenAISettingsPanel
            settings={settings}
            errors={settingsErrors}
            modelDiscovery={modelDiscovery}
            onChange={handleSettingsChange}
            onSave={handleSaveSettings}
            onFetchModels={() => void handleFetchModels()}
            showHeading={false}
          />
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <AppShell>
      <WorkbenchFrame
        brandRail={brandRail}
        composer={composer}
        canvas={canvas}
        mobileHeader={mobileHeader}
        mobileNavigation={mobileNavigation}
        overlay={settingsDrawer}
      />

      <ToastRegion message={toastMessage} />
      <ResultPreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
      <GuideVideoModal open={isGuideVideoOpen} onClose={() => setIsGuideVideoOpen(false)} />
    </AppShell>
  );
}
