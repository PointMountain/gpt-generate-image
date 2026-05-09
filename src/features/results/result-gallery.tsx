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
          <p className="section-heading__eyebrow">Inspiration Gallery</p>
          <h3 id="current-results-heading">当前结果</h3>
          <p>最新生成会沉到这里，方便你预览、下载、改写提示词或继续作为参考图迭代。</p>
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
          title="生成结果会成为你的灵感画廊"
          body="先完成右侧 OpenAI 设置，再在下方写提示词。生成后可以直接预览、下载、复用为参考图或继续改写。"
        />
      )}
    </section>
  );
}
