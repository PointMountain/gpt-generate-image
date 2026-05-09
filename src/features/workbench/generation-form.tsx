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
    <div className="composer-panel">
      <div className="surface-header surface-header--tight">
        <div>
          <p className="section-heading__eyebrow">Create workspace</p>
          <h2>创作下一轮</h2>
          <p>先写提示词，再决定是否附加参考图或 mask，最后生成并把结果带回下一轮。</p>
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
            {hasReferenceImage ? <span>{form.referenceImages.length} 张参考图将随请求发送</span> : null}
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
    </div>
  );
}
