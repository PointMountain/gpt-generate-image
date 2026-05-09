import { DropdownField, type DropdownOption } from '../../components/form/dropdown-field';
import {
  BACKGROUND_OPTIONS as OPENAI_BACKGROUND_OPTIONS,
  FORMAT_OPTIONS as OPENAI_FORMAT_OPTIONS,
  QUALITY_OPTIONS as OPENAI_QUALITY_OPTIONS,
  SIZE_OPTIONS as OPENAI_SIZE_OPTIONS,
} from '../../lib/openai/openai-option-sets';

interface GenerationControlsProps {
  size: string;
  count: number;
  quality: string;
  outputFormat: string;
  background: string;
  outputCompression: number;
  onChange: (
    field: 'size' | 'count' | 'quality' | 'outputFormat' | 'background' | 'outputCompression',
    value: string,
  ) => void;
}

const SIZE_OPTIONS: DropdownOption[] = OPENAI_SIZE_OPTIONS.map((option, index) => (
  index === 0 ? { ...option, label: '自动（推荐）' } : option
));
const QUALITY_OPTIONS: DropdownOption[] = OPENAI_QUALITY_OPTIONS.map((option) => {
  if (option.value === 'low') {
    return { ...option, label: '快速（更稳）' };
  }

  return option;
});
const COUNT_OPTIONS: DropdownOption[] = [1, 2, 3, 4].map((count) => ({
  value: String(count),
  label: `${count} 张`,
}));
const FORMAT_OPTIONS: DropdownOption[] = OPENAI_FORMAT_OPTIONS;
const BACKGROUND_OPTIONS: DropdownOption[] = OPENAI_BACKGROUND_OPTIONS;

export function GenerationControls({
  size,
  count,
  quality,
  outputFormat,
  background,
  outputCompression,
  onChange,
}: GenerationControlsProps) {
  return (
    <div className="section-card section-card--flat generation-controls">
      <div className="list-header list-header--compact">
        <div>
          <h3>生成参数</h3>
          <p>自动值不会随请求发送，模型会按默认策略处理。</p>
        </div>
      </div>
      <div className="field-grid field-grid--two">
        <DropdownField
          id="image-size"
          label="尺寸"
          value={size}
          options={SIZE_OPTIONS}
          onChange={(value) => onChange('size', value)}
          hint="不同模型支持的尺寸会变化。"
        />
        <DropdownField
          id="image-count"
          label="张数"
          value={String(count)}
          options={COUNT_OPTIONS}
          onChange={(value) => onChange('count', value)}
        />
        <DropdownField
          id="image-quality"
          label="质量"
          value={quality}
          options={QUALITY_OPTIONS}
          onChange={(value) => onChange('quality', value)}
          hint="请求不稳时先切到快速。"
        />
        <DropdownField
          id="image-format"
          label="输出格式"
          value={outputFormat}
          options={FORMAT_OPTIONS}
          onChange={(value) => onChange('outputFormat', value)}
          hint="自动格式不会随请求发送。"
        />
        <DropdownField
          id="image-background"
          label="背景"
          value={background}
          options={BACKGROUND_OPTIONS}
          onChange={(value) => onChange('background', value)}
        />
        <div className="field">
          <label htmlFor="image-compression">压缩</label>
          <input
            id="image-compression"
            type="number"
            min={0}
            max={100}
            value={outputCompression}
            onChange={(event) => onChange('outputCompression', event.target.value)}
          />
          <span className="field__hint">0 表示不发送 output_compression。</span>
        </div>
      </div>
    </div>
  );
}
