interface GenerationControlsProps {
  size: string;
  count: number;
  quality: string;
  outputFormat: string;
  onChange: (field: 'size' | 'count' | 'quality' | 'outputFormat', value: string) => void;
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

export function GenerationControls({
  size,
  count,
  quality,
  outputFormat,
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
          <span className="field__hint">部分 provider 对显式尺寸更敏感，优先使用自动。</span>
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
          <span className="field__hint">自动格式的兼容性通常最好。</span>
        </div>
      </div>
    </div>
  );
}
