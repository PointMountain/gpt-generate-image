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
    <section>
      <div className="section-heading">
        <div>
          <h3>当前结果</h3>
          <p>这里展示当前这一轮的最新结果，可直接预览、下载或转成参考图。</p>
        </div>
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
          eyebrow="当前结果"
          title="这里会出现你的最新结果"
          body="先完成连接配置，再输入提示词并提交生成。"
        />
      )}
    </section>
  );
}
