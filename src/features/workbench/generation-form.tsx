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
  const modeLabel = form.mode === 'text' ? '文生图' : form.mode === 'image' ? '图生图' : '遮罩编辑';

  return (
    <div className="composer-panel" aria-label="创作配方编辑器">
      <div className="surface-header surface-header--tight">
        <div>
          <p className="section-heading__eyebrow">创作配方</p>
          <h2>把想法压进画布</h2>
          <p>写下画面，再补充输入素材与关键参数。高级设置会在需要时出现。</p>
        </div>
        <div className="composer-panel__badges">
          <span className="surface-header__badge">
            {selectedModelLabel || '未选择模型'}
          </span>
          <span className="surface-header__badge">{modeLabel}</span>
        </div>
      </div>

      <div className="composer-flow" aria-label="图片生成操作流">
        <ReferenceImageDropzone
          mode={form.mode}
          referenceImages={form.referenceImages}
          supportsReferenceImages={supportsReferenceImages}
          onModeChange={(mode) => onChangeForm({ ...form, mode })}
          onAddFiles={onAddReferenceFiles}
          onRemove={onRemoveReferenceImage}
        />

        <PromptEditor
          prompt={form.prompt}
          onChangePrompt={(value) => onChangeForm({ ...form, prompt: value })}
        />

        {hasReferenceImage || hasMask ? (
          <div className="asset-summary" aria-live="polite">
            {hasReferenceImage ? <span>{form.referenceImages.length} 张输入素材将随请求发送</span> : null}
            {hasMask ? <span>mask 文件已附加</span> : null}
          </div>
        ) : null}

        <div className="composer-panel__controls">
          <MaskImageDropzone
            mode={form.mode}
            previewUrl={form.maskPreviewUrl}
            fileName={form.maskFile?.name ?? ''}
            onSelectFile={onSelectMaskFile}
            onClear={() => onSelectMaskFile(null)}
          />

          <GenerationControls
            modelId={selectedModelLabel}
            size={form.size}
            count={form.count}
            quality={form.quality}
            outputFormat={form.outputFormat}
            background={form.background}
            outputCompression={form.outputCompression}
            onChange={(field, value) => {
              const nextForm = {
                ...form,
                [field]: field === 'count' || field === 'outputCompression' ? Number(value) : value,
              };

              if (field === 'outputFormat' && value === 'jpeg' && nextForm.background === 'transparent') {
                nextForm.background = 'auto';
              }
              if (field === 'outputFormat' && !['jpeg', 'webp'].includes(value)) {
                nextForm.outputCompression = 0;
              }

              onChangeForm(nextForm);
            }}
          />
        </div>

        <GenerationActions
          canGenerate={canGenerate}
          isGenerating={isGenerating}
          onGenerate={onGenerate}
          onClear={onClear}
        />
      </div>
    </div>
  );
}
