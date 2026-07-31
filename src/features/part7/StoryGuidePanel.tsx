import type { StoryGuide } from '../../domain/entities'

interface StoryGuidePanelProps {
  guide?: StoryGuide
  onRequestReference?: () => void
}

export function StoryGuidePanel({
  guide,
  onRequestReference,
}: StoryGuidePanelProps) {
  if (!guide) return null
  return (
    <details className="card guide-details story-guide-panel">
      <summary>
        <h2>원본 이야기 흐름 참고</h2>
      </summary>
      <p className="source-context">
        원본 workbook에 포함된 검수 전 이야기 구성 자료입니다. 완성 답변이나
        공식 정답이 아닙니다.
      </p>
      {guide.situation_ko && (
        <section>
          <h3>한국어 상황</h3>
          <p className="preserve-lines" lang="ko">{guide.situation_ko}</p>
        </section>
      )}
      <section>
        <h3>추천 이야기 흐름</h3>
        <p className="preserve-lines">{guide.recommended_flow}</p>
      </section>
      {guide.recommended_connectors_zh && (
        <section>
          <h3>원본 연결어</h3>
          <p className="preserve-lines" lang="zh-CN">
            {guide.recommended_connectors_zh}
          </p>
        </section>
      )}
      {guide.material_nature && (
        <p className="field-help">자료 성격: {guide.material_nature}</p>
      )}
      {onRequestReference && (
        <button
          className="secondary-button"
          type="button"
          onClick={onRequestReference}
        >
          내 이야기 포인트로 참고
        </button>
      )}
    </details>
  )
}
