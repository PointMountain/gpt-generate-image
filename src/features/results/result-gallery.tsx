import { EmptyState } from '../../components/status/empty-state';
import type { ResultImage } from '../history/history-types';
import { ResultCard } from './result-card';

interface ResultGalleryProps {
  results: ResultImage[];
  onPreview: (image: ResultImage) => void;
  onDownload: (image: ResultImage, index: number) => void;
  onUseAsReference: (image: ResultImage) => void;
  onReusePrompt: () => void;
}

export function ResultGallery({
  results,
  onPreview,
  onDownload,
  onUseAsReference,
  onReusePrompt,
}: ResultGalleryProps) {
  return (
    <section className="gallery-stage" aria-labelledby="current-results-heading">
      <div className="section-heading section-heading--gallery">
        <div>
          <p className="section-heading__eyebrow">Result loop</p>
          <h3 id="current-results-heading">当前结果</h3>
          <p>每张图都能直接预览、下载、设为参考图，或把提示词带回下一轮。</p>
        </div>
        {results.length ? <span className="surface-header__badge">{results.length} 张图片</span> : null}
      </div>

      {results.length ? (
        <div className="result-grid">
          {results.map((image, index) => (
            <ResultCard
              key={image.id}
              image={image}
              index={index}
              onPreview={onPreview}
              onDownload={onDownload}
              onUseAsReference={onUseAsReference}
              onReusePrompt={onReusePrompt}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          eyebrow="等待第一张作品"
          title="先在左侧完成第一轮生成"
          body="保存 OpenAI 设置，写一段提示词，然后生成。结果会出现在这里，并能直接进入下一轮参考图流程。"
        />
      )}
    </section>
  );
}
