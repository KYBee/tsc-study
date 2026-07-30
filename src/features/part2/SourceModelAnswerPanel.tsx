import { LanguageBlock } from '../../components/LanguageBlock'
import type { ModelAnswer } from '../../domain/entities'

interface SourceModelAnswerPanelProps {
  answers: ModelAnswer[]
}

export function SourceModelAnswerPanel({
  answers,
}: SourceModelAnswerPanelProps) {
  return (
    <details className="card guide-details source-answer-panel">
      <summary>
        <h2>원본 추천 답변</h2>
      </summary>
      <p className="source-context">
        원본 workbook에 포함된 검수 전 답변입니다. 공식 정답이나 검수 완료
        답변이 아닙니다.
      </p>
      {answers.map((answer) => (
        <div key={answer.answer_id} className="source-answer">
          <LanguageBlock
            label={`원본 추천 답변 ${answer.answer_id}`}
            language={{
              zh: answer.answer_zh,
              pinyin: answer.answer_pinyin,
              ko: answer.answer_ko,
            }}
          />
          {answer.answer_zh && (
            <button
              className="text-button"
              type="button"
              onClick={() => void navigator.clipboard?.writeText(answer.answer_zh ?? '')}
            >
              전체 답변 복사
            </button>
          )}
        </div>
      ))}
    </details>
  )
}
