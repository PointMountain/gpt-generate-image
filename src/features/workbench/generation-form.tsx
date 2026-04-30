import { PromptEditor } from './prompt-editor';
import { ReferenceImageDropzone } from './reference-image-dropzone';
import { GenerationControls } from './generation-controls';
import { GenerationActions } from './generation-actions';

export interface GenerationFormState {
  prompt: string;
  negativePrompt: string;
  size: string;
  count: number;
  quality: string;
  outputFormat: string;
  mode: 'text' | 'reference';
  referenceFile: File | null;
  referencePreviewUrl: string;
}

export function createDefaultGenerationFormState(
  overrides: Partial<GenerationFormState> = {},
): GenerationFormState {
  return {
    prompt: '',
    negativePrompt: '',
    size: '1024x1024',
    count: 1,
    quality: 'high',
    outputFormat: 'png',
    mode: 'text',
    referenceFile: null,
    referencePreviewUrl: '',
    ...overrides,
  };
}

export function isPristineGenerationForm(form: GenerationFormState) {
  const defaults = createDefaultGenerationFormState();

  return (
    form.prompt === defaults.prompt &&
    form.negativePrompt === defaults.negativePrompt &&
    form.size === defaults.size &&
    form.count === defaults.count &&
    form.quality === defaults.quality &&
    form.outputFormat === defaults.outputFormat &&
    form.mode === defaults.mode &&
    form.referenceFile === defaults.referenceFile &&
    form.referencePreviewUrl === defaults.referencePreviewUrl
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
  onSelectReferenceFile: (file: File | null) => void;
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
  onSelectReferenceFile,
}: GenerationFormProps) {
  const hasReferenceImage = form.mode === 'reference' && Boolean(form.referencePreviewUrl);

  return (
    <div className="composer-panel">
      <div className="surface-header surface-header--tight">
        <div>
          <p className="section-heading__eyebrow">Create</p>
          <h2>创作下一轮</h2>
          <p>写提示词，保留常用参数，继续把结果推入上方灵感画廊。</p>
        </div>
        <div className="composer-panel__badges">
          <span className="surface-header__badge">
            当前模型：{selectedModelLabel || '未选择'}
          </span>
          {hasReferenceImage ? <span className="surface-header__badge">参考图已附加</span> : null}
        </div>
      </div>

      <PromptEditor
        prompt={form.prompt}
        negativePrompt={form.negativePrompt}
        onChangePrompt={(value) => onChangeForm({ ...form, prompt: value })}
        onChangeNegativePrompt={(value) => onChangeForm({ ...form, negativePrompt: value })}
      />

      <div className="composer-panel__controls">
        <ReferenceImageDropzone
          mode={form.mode}
          previewUrl={form.referencePreviewUrl}
          fileName={form.referenceFile?.name ?? ''}
          supportsReferenceImages={supportsReferenceImages}
          onModeChange={(mode) => onChangeForm({ ...form, mode })}
          onSelectFile={onSelectReferenceFile}
          onClear={() => onSelectReferenceFile(null)}
        />

        <GenerationControls
          size={form.size}
          count={form.count}
          quality={form.quality}
          outputFormat={form.outputFormat}
          onChange={(field, value) =>
            onChangeForm({
              ...form,
              [field]: field === 'count' ? Number(value) : value,
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
