import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { createNavigationContext, type SafeReturnPath } from '../../app/navigationContext'
import { EmptyState } from '../../components/EmptyState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { StatusBadge } from '../../components/StatusBadge'
import type {
  InputLanguage,
  Question,
  RecallMode,
  RecallResult,
} from '../../domain/entities'
import type {
  StoredPracticeDraft,
  StoredReusablePhrase,
  UserDataRepository,
} from '../../data/userDataRepository'
import { mapRecallResultToReviewStatus } from './part4AnswerDraft'
import type { CorrectionProvider } from '../../providers/CorrectionProvider'
import {
  createCorrectionSession,
  saveCorrectionSession,
} from './correctionSession'

const INPUT_LANGUAGE_OPTIONS: Array<{ value: InputLanguage; label: string }> = [
  { value: 'ko', label: '한국어로 작성' },
  { value: 'zh', label: '중국어로 작성' },
  { value: 'mixed', label: '한국어·중국어 혼합' },
]

const RECALL_MODES: Array<{ value: RecallMode; label: string }> = [
  { value: 'full', label: '전체 보기' },
  { value: 'answer_only', label: '답변만 보기' },
  { value: 'question_only', label: '질문만 보기' },
]

const RECALL_RESULTS: Array<{ value: RecallResult; label: string }> = [
  { value: 'could_not_say', label: '못 말함' },
  { value: 'used_keywords', label: '키워드 보고 말함' },
  { value: 'almost', label: '거의 말함' },
  { value: 'memorized', label: '외워서 말함' },
]

interface GenericAnswerEditorContentProps {
  question: Question
  initialDraft?: StoredPracticeDraft
  initialPhrases: StoredReusablePhrase[]
  returnTo: SafeReturnPath
  userRepository: UserDataRepository
  correctionProvider: CorrectionProvider
}

export function GenericAnswerEditorContent({
  question,
  initialDraft,
  initialPhrases,
  returnTo,
  userRepository,
  correctionProvider,
}: GenericAnswerEditorContentProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState(initialDraft)
  const [input, setInput] = useState(
    initialDraft?.full_text ?? initialDraft?.original_input ?? '',
  )
  const [inputLanguage, setInputLanguage] = useState<InputLanguage>(
    initialDraft?.input_language ?? 'ko',
  )
  const [phrases, setPhrases] = useState(initialPhrases)
  const [recallMode, setRecallMode] = useState<RecallMode>(
    (searchParams.get('mode') as RecallMode) ?? 'full',
  )
  const [answerRevealed, setAnswerRevealed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const step = searchParams.get('step') === 'recall'
    ? 'recall'
    : searchParams.get('step') === 'complete'
      ? 'complete'
      : 'write'
  const navigationState = createNavigationContext(returnTo)

  const moveTo = (next: 'write' | 'complete' | 'recall') => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('step', next)
    setSearchParams(nextParams, { replace: true })
    setMessage('')
    setFormError('')
  }

  const saveDraft = async (completed: boolean) => {
    const text = input.trim()
    if (!text) {
      setFormError('답변을 입력해 주세요')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const saved = await userRepository.upsertPracticeDraft({
        practice_draft_id: `pd-${question.question_id}`,
        question_id: question.question_id,
        input_language: inputLanguage,
        original_input: text,
        full_text: text,
        completion_status: completed ? 'completed' : 'in_progress',
        completed_at: completed ? new Date().toISOString() : undefined,
        draft_status: 'draft',
      })
      setDraft(saved)
      setMessage(completed ? '답변 작성을 완료했습니다' : '연습 초안을 저장했습니다')
      if (completed) moveTo('complete')
    } catch (cause: unknown) {
      console.error(cause)
      setFormError('연습 초안을 저장하지 못했습니다. 입력은 그대로 유지됩니다.')
    } finally {
      setSaving(false)
    }
  }

  const deleteDraft = async () => {
    if (!draft || !window.confirm('저장된 연습 초안을 삭제할까요?')) return
    await userRepository.deletePracticeDraft(draft.practice_draft_id)
    setDraft(undefined)
    setInput('')
    setMessage('저장된 연습 초안을 삭제했습니다')
    moveTo('write')
  }

  const saveReusablePhrase = async () => {
    const text = input.trim()
    if (!text) {
      setFormError('재사용할 표현을 먼저 입력해 주세요')
      return
    }
    const id = `rp-${question.question_id}-${String(phrases.length + 1).padStart(3, '0')}`
    const saved = await userRepository.upsertReusablePhrase({
      reusable_phrase_id: id,
      text,
      language: inputLanguage,
      phrase_type: 'other',
      source_kind: 'user_created',
      source_question_id: question.question_id,
    })
    setPhrases((current) => [
      ...current.filter((phrase) => phrase.reusable_phrase_id !== id),
      saved,
    ])
    setMessage('내 재사용 표현으로 저장했습니다')
  }

  const recordRecall = async (result: RecallResult) => {
    if (!draft) return
    const timestamp = new Date().toISOString()
    await userRepository.addRecallAttempt({
      recall_attempt_id: `ra-${question.question_id}-${timestamp}`,
      question_id: question.question_id,
      practice_draft_id: draft.practice_draft_id,
      recall_mode: recallMode,
      result,
      attempted_at: timestamp,
    })
    await userRepository.upsertReviewState({
      review_state_id: `rs-question-${question.question_id}`,
      target_type: 'question',
      target_id: question.question_id,
      learning_status: mapRecallResultToReviewStatus(result),
      last_reviewed_at: timestamp,
    })
    setMessage('회상 결과와 복습 상태를 저장했습니다')
  }

  const requestCorrection = async () => {
    const originalInput = draft?.original_input ?? input.trim()
    if (!originalInput || correcting) return
    setCorrecting(true)
    setFormError('')
    const baseSession = createCorrectionSession({
      question_id: question.question_id,
      correction_mode: 'minimal',
      input_language: draft?.input_language ?? inputLanguage,
      original_input: originalInput,
      provider_result: null,
    })
    saveCorrectionSession(baseSession)
    try {
      const providerResult = await correctionProvider.correct({
        question_id: question.question_id,
        part: question.part,
        question_zh: question.question_zh,
        input_language: draft?.input_language ?? inputLanguage,
        original_input: originalInput,
        correction_mode: 'minimal',
      })
      saveCorrectionSession({ ...baseSession, provider_result: providerResult })
    } catch (cause: unknown) {
      console.error(cause)
      saveCorrectionSession({
        ...baseSession,
        provider_result: {
          status: 'failure',
          original_input: originalInput,
          message: '교정 요청을 처리하지 못했습니다',
          error_code: 'provider_exception',
        },
      })
    }
    navigate(`/questions/${question.question_id}/correction`, {
      state: navigationState,
    })
  }

  return (
    <div className="page answer-learning-page">
      <header className="page-header">
        <Link
          className="back-link"
          to={`/questions/${question.question_id}`}
          state={navigationState}
        >
          ← 문제로 돌아가기
        </Link>
        <div className="badge-row">
          <StatusBadge status="development_fixture" />
          <StatusBadge status="raw" />
        </div>
        <p className="eyebrow">PART {question.part} · {question.question_id}</p>
        <h1>
          {step === 'write'
            ? '내 답변 작성'
            : step === 'complete'
              ? '내가 작성한 연습 답변'
              : '암기 연습'}
        </h1>
        <p>입력한 원문만 저장하며 중국어·병음·번역을 자동 생성하지 않습니다.</p>
      </header>

      {step === 'write' && (
        <>
          <section className="card">
            <LanguageBlock
              label="연습 질문"
              language={{
                zh: question.question_zh,
                pinyin: question.question_pinyin,
                ko: question.question_ko,
              }}
            />
          </section>
          <section className="card">
            <fieldset className="compact-options">
              <legend>입력 방식</legend>
              {INPUT_LANGUAGE_OPTIONS.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="generic-input-language"
                    checked={inputLanguage === option.value}
                    onChange={() => setInputLanguage(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
            {inputLanguage === 'ko' && (
              <p className="notice">
                현재는 답변 내용과 구조를 먼저 저장합니다. 중국어 변환과 교정은
                실제 AI 연결 후 제공됩니다.
              </p>
            )}
            <label htmlFor="generic-answer-input">내 답변</label>
            <textarea
              id="generic-answer-input"
              rows={10}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="한국어·중국어 모두 괜찮아요. 틀려도 그대로 적으세요."
            />
            <p className="field-help">
              이 Part에서는 자유 입력으로 저장합니다. Part 4의 네 구간 구조를
              강제하지 않습니다.
            </p>
          </section>
          {phrases.length > 0 && (
            <details className="card">
              <summary>내가 저장한 재사용 표현</summary>
              <ul className="plain-list">
                {phrases.map((phrase) => (
                  <li key={phrase.reusable_phrase_id}>{phrase.text}</li>
                ))}
              </ul>
            </details>
          )}
          {formError && <p className="field-error" role="alert">{formError}</p>}
          {message && <p className="success-message" role="status">{message}</p>}
          <div className="button-row sticky-action">
            <button
              className="secondary-button"
              type="button"
              disabled={saving}
              onClick={() => void saveDraft(false)}
            >
              연습 초안 저장
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={saving}
              onClick={() => void saveDraft(true)}
            >
              답변 작성 완료
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void saveReusablePhrase()}
            >
              재사용 표현으로 저장
            </button>
            {draft && (
              <button className="danger-button" type="button" onClick={() => void deleteDraft()}>
                저장된 초안 삭제
              </button>
            )}
          </div>
        </>
      )}

      {step === 'complete' && (
        <>
          <section className="card">
            <h2>아직 교정되지 않은 내 연습 답변</h2>
            <p className="preserve-lines">{draft?.original_input ?? input}</p>
            <p className="source-context">
              답변 예시는 아직 없으며, 이 내용은 사용자가 직접 작성했습니다.
            </p>
          </section>
          {message && <p className="success-message" role="status">{message}</p>}
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => moveTo('write')}>
              답변 수정
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={correcting}
              onClick={() => void requestCorrection()}
            >
              {correcting ? '교정 요청 중…' : '교정 후 암기'}
            </button>
            <button className="secondary-button" type="button" onClick={() => moveTo('recall')}>
              교정 없이 암기
            </button>
            <Link className="secondary-button" to={`/parts/${question.part}`}>
              목록으로
            </Link>
          </div>
        </>
      )}

      {step === 'recall' && (
        <>
          {!draft ? (
            <EmptyState
              title="암기할 내 답변이 없습니다"
              action={
                <button className="primary-button" type="button" onClick={() => moveTo('write')}>
                  답변 작성
                </button>
              }
            />
          ) : (
            <>
              <section className="card">
                <h2>암기 모드</h2>
                <div className="segmented-control" role="radiogroup" aria-label="암기 모드">
                  {RECALL_MODES.map((mode) => (
                    <label key={mode.value}>
                      <input
                        type="radio"
                        name="generic-recall-mode"
                        value={mode.value}
                        checked={recallMode === mode.value}
                        onChange={() => {
                          setRecallMode(mode.value)
                          setAnswerRevealed(false)
                        }}
                      />
                      {mode.label}
                    </label>
                  ))}
                </div>
              </section>
              <section className="card recall-stage">
                {recallMode !== 'answer_only' && (
                  <LanguageBlock
                    label="질문"
                    language={{
                      zh: question.question_zh,
                      pinyin: question.question_pinyin,
                      ko: question.question_ko,
                    }}
                  />
                )}
                {recallMode === 'full' && (
                  <p className="preserve-lines">{draft.original_input}</p>
                )}
                {recallMode === 'answer_only' && (
                  <p className="preserve-lines">{draft.original_input}</p>
                )}
                {recallMode === 'question_only' && !answerRevealed && (
                  <p>답변을 머릿속으로 또는 소리 내어 말해 보세요.</p>
                )}
                {!answerRevealed && (
                  <button className="primary-button" type="button" onClick={() => setAnswerRevealed(true)}>
                    답변 보기
                  </button>
                )}
                {answerRevealed && recallMode === 'question_only' && (
                  <p className="preserve-lines">{draft.original_input}</p>
                )}
              </section>
              {answerRevealed && (
                <section className="card">
                  <h2>어떻게 말했나요?</h2>
                  <div className="status-button-group">
                    {RECALL_RESULTS.map((result) => (
                      <button key={result.value} type="button" onClick={() => void recordRecall(result.value)}>
                        {result.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {message && <p className="success-message" role="status">{message}</p>}
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={() => setAnswerRevealed(false)}>
                  다시 시도
                </button>
                <Link className="secondary-button" to={`/parts/${question.part}`}>
                  다른 문제
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
