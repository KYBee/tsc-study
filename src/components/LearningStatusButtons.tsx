import { useState } from 'react'

import type { LearningTargetType } from '../domain/entities'
import type {
  StoredReviewState,
  UserDataRepository,
} from '../data/userDataRepository'

interface LearningStatusButtonsProps {
  targetType: LearningTargetType
  targetId: string
  initialReviewState?: StoredReviewState
  userRepository: UserDataRepository
  onSaved?: (reviewState: StoredReviewState) => void
}

const SIMPLE_STATUSES = ['못 외움', '외움'] as const

export function LearningStatusButtons({
  targetType,
  targetId,
  initialReviewState,
  userRepository,
  onSaved,
}: LearningStatusButtonsProps) {
  const [reviewState, setReviewState] = useState(initialReviewState)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const save = async (learningStatus: (typeof SIMPLE_STATUSES)[number]) => {
    if (saving) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const saved = await userRepository.upsertReviewState({
        review_state_id:
          reviewState?.review_state_id ?? `rs-${targetType}-${targetId}`,
        target_type: targetType,
        target_id: targetId,
        learning_status: learningStatus,
      })
      setReviewState(saved)
      setMessage('암기 상태를 저장했습니다.')
      onSaved?.(saved)
    } catch {
      setError('암기 상태를 저장하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="learning-status-control">
      <p className="current-learning-status">
        현재 상태: {reviewState?.learning_status ?? '미체크'}
      </p>
      <div className="status-button-group" aria-label="암기 상태">
        {SIMPLE_STATUSES.map((status) => (
          <button
            key={status}
            className="status-button"
            type="button"
            disabled={saving}
            aria-pressed={reviewState?.learning_status === status}
            onClick={() => void save(status)}
          >
            {status}
          </button>
        ))}
      </div>
      {message && <p className="success-message" role="status">{message}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}
