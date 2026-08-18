import { useEffect, useId, useRef, useState } from 'react'

import type { InputLanguage, LearningTargetType } from '../domain/entities'
import type {
  StoredPracticeDraft,
  UserDataRepository,
} from '../data/userDataRepository'

interface SimpleAnswerEditorProps {
  targetType: LearningTargetType
  targetId: string
  initialDraft?: StoredPracticeDraft
  fallbackOriginalInput?: string
  fallbackInputLanguage?: InputLanguage
  userRepository: UserDataRepository
  label?: string
  placeholder?: string
  rows?: number
  onSaved?: (draft: StoredPracticeDraft) => void
}

function getInitialText(
  draft: StoredPracticeDraft | undefined,
  fallbackOriginalInput: string | undefined,
): string {
  return draft?.full_text?.trim()
    ? draft.full_text
    : draft?.original_input ?? fallbackOriginalInput ?? ''
}

export function detectInputLanguage(
  text: string,
  fallback: InputLanguage = 'mixed',
): InputLanguage {
  const hasChinese = /[\u3400-\u9fff]/u.test(text)
  const hasKorean = /[\uac00-\ud7a3]/u.test(text)
  if (hasChinese && !hasKorean) return 'zh'
  if (hasKorean && !hasChinese) return 'ko'
  if (hasChinese && hasKorean) return 'mixed'
  return fallback
}

export function SimpleAnswerEditor({
  targetType,
  targetId,
  initialDraft,
  fallbackOriginalInput,
  fallbackInputLanguage,
  userRepository,
  label = '내 답변',
  placeholder = '내 답변을 입력하세요.',
  rows = 7,
  onSaved,
}: SimpleAnswerEditorProps) {
  const generatedId = useId()
  const activeTargetKey = useRef(`${targetType}:${targetId}`)
  const [draft, setDraft] = useState(initialDraft)
  const [input, setInput] = useState(() =>
    getInitialText(initialDraft, fallbackOriginalInput),
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const nextTargetKey = `${targetType}:${targetId}`
    if (activeTargetKey.current === nextTargetKey) return
    activeTargetKey.current = nextTargetKey
    setDraft(initialDraft)
    setInput(getInitialText(initialDraft, fallbackOriginalInput))
    setMessage('')
    setError('')
  }, [fallbackOriginalInput, initialDraft, targetId, targetType])

  const save = async () => {
    const text = input.trim()
    if (!text) {
      setMessage('')
      setError('답변을 입력해 주세요.')
      return
    }
    if (saving) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const saved = await userRepository.upsertPracticeDraft({
        practice_draft_id: draft?.practice_draft_id ?? `pd-${targetId}`,
        question_id: targetId,
        target_type: targetType,
        target_id: targetId,
        input_language: detectInputLanguage(
          text,
          draft?.input_language ?? fallbackInputLanguage ?? 'mixed',
        ),
        original_input: text,
        full_text: text,
        completion_status: 'completed',
        completed_at: new Date().toISOString(),
        draft_status: 'draft',
      })
      setDraft(saved)
      setInput(saved.full_text ?? saved.original_input)
      setMessage('저장되었습니다.')
      onSaved?.(saved)
    } catch {
      setError('답변을 저장하지 못했습니다. 입력은 그대로 유지됩니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="simple-answer-editor">
      <label htmlFor={generatedId}>{label}</label>
      <textarea
        id={generatedId}
        rows={rows}
        value={input}
        placeholder={placeholder}
        onChange={(event) => {
          setInput(event.target.value)
          setMessage('')
          setError('')
        }}
      />
      <button
        className="primary-button"
        type="button"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? '저장 중…' : draft ? '수정 저장' : '답변 저장'}
      </button>
      {message && <p className="success-message" role="status">{message}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}
