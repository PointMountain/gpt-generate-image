import { PromptEditor } from './prompt-editor';
import { ReferenceImageDropzone } from './reference-image-dropzone';
import { MaskImageDropzone } from './mask-image-dropzone';
import { GenerationControls } from './generation-controls';
import { GenerationActions } from './generation-actions';
import type { GenerationMode, ImageReferenceInput } from '../../lib/openai/ai-sdk-image-client';

export interface GenerationFormState {
  prompt: string;
  size: string;
  count: number;
  quality: string;
  outputFormat: string;
  background: string;
  outputCompression: number;
  mode: GenerationMode;
  referenceImages: ImageReferenceInput[];
  maskFile: File | null;
  maskPreviewUrl: string;
}

export function createDefaultGenerationFormState(
  overrides: Partial<GenerationFormState> = {},
): GenerationFormState {
  return {
    prompt: '',
    size: '1024x1024',
    count: 1,
    quality: 'auto',
    outputFormat: 'auto',
    background: 'auto',
    outputCompression: 0,
    mode: 'text',
    referenceImages: [],
    maskFile: null,
    maskPreviewUrl: '',
    ...overrides,
  };
}

export function isPristineGenerationForm(form: GenerationFormState) {
  const defaults = createDefaultGenerationFormState();

  return (
    form.prompt === defaults.prompt &&
    form.size === defaults.size &&
    form.count === defaults.count &&
    form.quality === defaults.quality &&
    form.outputFormat === defaults.outputFormat &&
    form.background === defaults.background &&
    form.outputCompression === defaults.outputCompression &&
    form.mode === defaults.mode &&
    form.referenceImages.length === 0 &&
    form.maskFile === defaults.maskFile &&
    form.maskPreviewUrl === defaults.maskPreviewUrl
  );
}

interface GenerationFormProps {
  form: GenerationFormState;
  selectedModelLabel: string;
  supportsReferenceImages: boolean;
  canGenerate: boolean;
  isGenerating: boolean;
  onChangeForm: (nextForm: GenerationFormState) => void;
  onGenerate: () => void;
  onClear: () => void;
  onAddReferenceFiles: (files: File[]) => void;
  onRemoveReferenceImage: (previewUrl: string) => void;
  onSelectMaskFile: (file: File | null) => void;
}

export function GenerationForm({
  form,
  selectedModelLabel,
  supportsReferenceImages,
  canGenerate,
  isGenerating,
  onChangeForm,
  onGenerate,
  onClear,
  onAddReferenceFiles,
  onRemoveReferenceImage,
  onSelectMaskFile,
}: GenerationFormProps) {
  const hasReferenceImage = form.mode !== 'text' && form.referenceImages.length > 0;
  const hasMask = form.mode === 'mask' && Boolean(form.maskPreviewUrl);

  return (
    <div className="composer-panel">
      <div className="surface-header surface-header--tight">
        <div>
          <p className="section-heading__eyebrow">Create</p>
          <h2>创作下一轮</h2>
          <p>写提示词，按需要附加参考图或 mask，再用 OpenAI 生成结果。</p>
        </div>
        <div className="composer-panel__badges">
          <span className="surface-header__badge">
            当前模型：{selectedModelLabel || '未选择'}
          </span>
          {hasReferenceImage ? <span className="surface-header__badge">{form.referenceImages.length} 张参考图</span> : null}
          {hasMask ? <span className="surface-header__badge">Mask 已附加</span> : null}
        </div>
      </div>

      <PromptEditor
        prompt={form.prompt}
        onChangePrompt={(value) => onChangeForm({ ...form, prompt: value })}
      />

      <div className="composer-panel__controls">
        <ReferenceImageDropzone
          mode={form.mode}
          referenceImages={form.referenceImages}
          supportsReferenceImages={supportsReferenceImages}
          onModeChange={(mode) => onChangeForm({ ...form, mode })}
          onAddFiles={onAddReferenceFiles}
          onRemove={onRemoveReferenceImage}
        />

        <MaskImageDropzone
          mode={form.mode}
          previewUrl={form.maskPreviewUrl}
          fileName={form.maskFile?.name ?? ''}
          onSelectFile={onSelectMaskFile}
          onClear={() => onSelectMaskFile(null)}
        />

        <GenerationControls
          size={form.size}
          count={form.count}
          quality={form.quality}
          outputFormat={form.outputFormat}
          background={form.background}
          outputCompression={form.outputCompression}
          onChange={(field, value) =>
            onChangeForm({
              ...form,
              [field]: field === 'count' || field === 'outputCompression' ? Number(value) : value,
            })
          }
        />
      </div>

      <GenerationActions
        canGenerate={canGenerate}
        isGenerating={isGenerating}
        onGenerate={onGenerate}
        onClear={onClear}
      />
    </div>
  );
}
