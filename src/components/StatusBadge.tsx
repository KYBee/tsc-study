interface StatusBadgeProps {
  status:
    | 'development_fixture'
    | 'raw'
    | 'review_needed'
    | 'source_review_needed'
    | 'has_answer'
    | 'has_draft'
    | 'unstarted'
    | '못 외움'
    | '헷갈림'
    | '외움'
}

const STATUS_LABELS: Record<StatusBadgeProps['status'], string> = {
  development_fixture: '개발용 표본',
  raw: 'raw · 검수 전',
  review_needed: '검수 필요',
  source_review_needed: '출처 확인 필요',
  has_answer: '내 답변 있음',
  has_draft: '연습 초안 있음',
  unstarted: '학습 전',
  '못 외움': '못 외움',
  헷갈림: '헷갈림',
  외움: '외움',
}

const STATUS_CLASSES: Record<StatusBadgeProps['status'], string> = {
  development_fixture: 'development-fixture',
  raw: 'raw',
  review_needed: 'review-needed',
  source_review_needed: 'source-review-needed',
  has_answer: 'has-answer',
  has_draft: 'has-draft',
  unstarted: 'unstarted',
  '못 외움': 'not-memorized',
  헷갈림: 'confused',
  외움: 'memorized',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`status-badge status-badge--${STATUS_CLASSES[status]}`}
      data-status={status}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
