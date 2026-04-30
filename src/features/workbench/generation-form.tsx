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
  return (
    <div className="panel-grid">
      <div className="surface-header">
        <div>
          <h2>生成</h2>
          <p>写提示词、选择模式并提交请求。连接和兼容设置放在右侧处理。</p>
        </div>
        <span className="surface-header__badge">
          当前模型：{selectedModelLabel || '未选择'}
        </span>
      </div>

      <PromptEditor
        prompt={form.prompt}
        negativePrompt={form.negativePrompt}
        onChangePrompt={(value) => onChangeForm({ ...form, prompt: value })}
        onChangeNegativePrompt={(value) => onChangeForm({ ...form, negativePrompt: value })}
      />

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

      <GenerationActions
        canGenerate={canGenerate}
        isGenerating={isGenerating}
        onGenerate={onGenerate}
        onClear={onClear}
      />
    </div>
  );
}
