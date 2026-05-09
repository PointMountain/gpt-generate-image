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

const SIZE_OPTIONS = [
  { value: 'auto', label: '自动（推荐）' },
  { value: '1024x1024', label: '1024 × 1024' },
  { value: '1536x1024', label: '1536 × 1024' },
  { value: '1024x1536', label: '1024 × 1536' },
  { value: '2048x2048', label: '2048 × 2048' },
];
const QUALITY_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'high', label: '高质量' },
  { value: 'medium', label: '均衡' },
  { value: 'low', label: '快速（更稳）' },
];
const FORMAT_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WEBP' },
];
const BACKGROUND_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'transparent', label: '透明' },
  { value: 'opaque', label: '不透明' },
];

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
    <div className="section-card section-card--flat">
      <div className="field-grid field-grid--two">
        <div className="field">
          <label htmlFor="image-size">尺寸</label>
          <select
            id="image-size"
            value={size}
            onChange={(event) => onChange('size', event.target.value)}
          >
            {SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="field__hint">OpenAI 支持的尺寸会随模型变化，自动值不会随请求发送。</span>
        </div>
        <div className="field">
          <label htmlFor="image-count">张数</label>
          <select
            id="image-count"
            value={count}
            onChange={(event) => onChange('count', event.target.value)}
          >
            {[1, 2, 3, 4].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="image-quality">质量</label>
          <select
            id="image-quality"
            value={quality}
            onChange={(event) => onChange('quality', event.target.value)}
          >
            {QUALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="field__hint">如果上游容易超时，先切到快速。</span>
        </div>
        <div className="field">
          <label htmlFor="image-format">输出格式</label>
          <select
            id="image-format"
            value={outputFormat}
            onChange={(event) => onChange('outputFormat', event.target.value)}
          >
            {FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="field__hint">自动格式不会随请求发送。</span>
        </div>
        <div className="field">
          <label htmlFor="image-background">背景</label>
          <select
            id="image-background"
            value={background}
            onChange={(event) => onChange('background', event.target.value)}
          >
            {BACKGROUND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
