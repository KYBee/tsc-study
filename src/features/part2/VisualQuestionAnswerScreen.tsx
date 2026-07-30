import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import type {
  InputLanguage,
  ModelAnswer,
  RecallMode,
  RecallResult,
  VisualAsset,
  VisualQuestion,
  VisualSet,
} from '../../domain/entities'
import type {
  StoredPracticeDraft,
  StoredReusablePhrase,
  UserDataRepository,
} from '../../data/userDataRepository'
import { mapRecallResultToReviewStatus } from '../answer/part4AnswerDraft'
import { Part2VisualImage } from './Part2VisualImage'
import { SourceModelAnswerPanel } from './SourceModelAnswerPanel'

const INPUT_LANGUAGES: Array<{ value: InputLanguage; label: string }> = [
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '중국어' },
  { value: 'mixed', label: '혼합' },
]
const RECALL_MODES: Array<{ value: RecallMode; label: string }> = [
  { value: 'full', label: '그림 + 질문 + 내 답변 전체' },
  { value: 'visual_question', label: '그림 + 질문만' },
  { value: 'visual_only', label: '그림만' },
  { value: 'question_only', label: '질문만' },
]
const RECALL_RESULTS: Array<{ value: RecallResult; label: string }> = [
  { value: 'could_not_say', label: '못 말함' },
  { value: 'used_keywords', label: '어느 정도 말함' },
  { value: 'almost', label: '거의 말함' },
  { value: 'memorized', label: '외워서 말함' },
]
const setNumber = (visualSetId: string) =>
  Number(visualSetId.match(/V(\d+)$/)?.[1] ?? 0)

export function VisualQuestionAnswerScreen() {
  const { visualQuestionId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { publicRepository, userRepository } = useAppDependencies()
  const { data, error, loading } = useAsyncData(async () => {
    const question =
      await publicRepository.getVisualQuestionById(visualQuestionId)
    if (!question) return undefined
    const [visualSet, assets, answers, draft, phrases] = await Promise.all([
      publicRepository.getVisualSetById(question.visual_set_id),
      publicRepository.listVisualAssetsBySetId(question.visual_set_id),
      publicRepository.listModelAnswersByVisualQuestionId(visualQuestionId),
      userRepository.getPracticeDraftByTarget(
        'visual_question',
        visualQuestionId,
      ),
      userRepository.listReusablePhrases(),
    ])
    return {
      question,
      visualSet,
      asset: assets[0],
      answers,
      draft,
      phrases,
    }
  }, [publicRepository, userRepository, visualQuestionId])

  if (loading) return <LoadingState message="답변 화면을 준비하는 중입니다" />
  if (error || !data?.visualSet) {
    return <ErrorState title="그림 질문을 찾을 수 없습니다" message={visualQuestionId} />
  }
  const visualSet = data.visualSet
  return (
    <VisualAnswerContent
      key={visualQuestionId}
      {...data}
      visualSet={visualSet}
      visualQuestionId={visualQuestionId}
      searchParams={searchParams}
      setSearchParams={setSearchParams}
      userRepository={userRepository}
    />
  )
}

function VisualAnswerContent({
  question,
  visualSet,
  asset,
  answers,
  draft: initialDraft,
  phrases: initialPhrases,
  visualQuestionId,
  searchParams,
  setSearchParams,
  userRepository,
}: {
  question: VisualQuestion
  visualSet: VisualSet
  asset?: VisualAsset
  answers: ModelAnswer[]
  draft?: StoredPracticeDraft
  phrases: StoredReusablePhrase[]
  visualQuestionId: string
  searchParams: URLSearchParams
  setSearchParams: ReturnType<typeof useSearchParams>[1]
  userRepository: UserDataRepository
}) {
  const [draft, setDraft] = useState(initialDraft)
  const [input, setInput] = useState(
    initialDraft?.full_text ?? initialDraft?.original_input ?? '',
  )
  const [inputLanguage, setInputLanguage] = useState<InputLanguage>(
    initialDraft?.input_language ?? 'ko',
  )
  const [phrases, setPhrases] = useState(initialPhrases)
  const [recallMode, setRecallMode] = useState<RecallMode>('full')
  const [revealed, setRevealed] = useState(false)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const step =
    searchParams.get('step') === 'recall'
      ? 'recall'
      : searchParams.get('step') === 'complete'
        ? 'complete'
        : 'write'
  const number = setNumber(visualSet.visual_set_id)

  const move = (next: 'write' | 'complete' | 'recall') => {
    const params = new URLSearchParams(searchParams)
    params.set('step', next)
    setSearchParams(params, { replace: true })
    setRevealed(false)
  }
  const saveDraft = async (completed: boolean) => {
    const text = input.trim()
    if (!text) {
      setFormError('답변을 입력해 주세요')
      return
    }
    const saved = await userRepository.upsertPracticeDraft({
      practice_draft_id: `pd-${visualQuestionId}`,
      question_id: visualQuestionId,
      target_type: 'visual_question',
      target_id: visualQuestionId,
      input_language: inputLanguage,
      original_input: text,
      full_text: text,
      completion_status: completed ? 'completed' : 'in_progress',
      completed_at: completed ? new Date().toISOString() : undefined,
      draft_status: 'draft',
    })
    setDraft(saved)
    setMessage(completed ? '답변 작성을 완료했습니다' : '연습 초안을 저장했습니다')
    if (completed) move('complete')
  }
  const savePhrase = async () => {
    const text = input.trim()
    if (!text) return
    const id = `rp-${visualQuestionId}-${String(phrases.length + 1).padStart(3, '0')}`
    const saved = await userRepository.upsertReusablePhrase({
      reusable_phrase_id: id,
      text,
      language: inputLanguage,
      phrase_type: 'other',
      source_kind: 'user_created',
      source_question_id: visualQuestionId,
      source_target_type: 'visual_question',
      source_target_id: visualQuestionId,
    })
    setPhrases((items) => [...items.filter((item) => item.reusable_phrase_id !== id), saved])
    setMessage('내 재사용 표현으로 저장했습니다')
  }
  const deleteDraft = async () => {
    if (!draft || !window.confirm('저장된 연습 초안을 삭제할까요?')) return
    await userRepository.deletePracticeDraft(draft.practice_draft_id)
    setDraft(undefined)
    setInput('')
    move('write')
  }
  const recordRecall = async (result: RecallResult) => {
    if (!draft) return
    const timestamp = new Date().toISOString()
    await userRepository.addRecallAttempt({
      recall_attempt_id: `ra-${visualQuestionId}-${timestamp}`,
      question_id: visualQuestionId,
      target_type: 'visual_question',
      target_id: visualQuestionId,
      practice_draft_id: draft.practice_draft_id,
      recall_mode: recallMode,
      result,
      attempted_at: timestamp,
    })
    await userRepository.upsertReviewState({
      review_state_id: `rs-visual-question-${visualQuestionId}`,
      target_type: 'visual_question',
      target_id: visualQuestionId,
      learning_status: mapRecallResultToReviewStatus(result),
      last_reviewed_at: timestamp,
    })
    setMessage('회상 결과와 복습 상태를 저장했습니다')
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link className="back-link" to={`/visual-questions/${visualQuestionId}`}>← 세부 질문</Link>
        <p className="eyebrow">PART 2 · 세트 {number} · 질문 {question.item_number}</p>
        <h1>{step === 'write' ? '짧게 답변 작성' : step === 'complete' ? '내 연습 답변' : '그림 회상 연습'}</h1>
        <p>입력한 원문만 저장하며 번역·교정·병음을 자동 생성하지 않습니다.</p>
      </header>
      {step === 'write' && (
        <>
          <section className="card">
            <Part2VisualImage asset={asset} setNumber={number} />
            <LanguageBlock
              label="그림 질문"
              language={{
                zh: question.question_zh,
                pinyin: question.question_pinyin,
                ko: question.question_ko,
              }}
            />
          </section>
          <section className="card">
            <fieldset className="compact-options">
              <legend>입력 언어</legend>
              {INPUT_LANGUAGES.map((item) => (
                <label key={item.value}>
                  <input type="radio" name="part2-input-language" checked={inputLanguage === item.value} onChange={() => setInputLanguage(item.value)} />
                  {item.label}
                </label>
              ))}
            </fieldset>
            <label htmlFor="part2-answer">내 짧은 답변</label>
            <textarea id="part2-answer" rows={6} value={input} onChange={(event) => setInput(event.target.value)} placeholder="한국어·중국어 모두 괜찮아요. 그림을 보고 짧게 답하세요." />
            {formError && <p className="field-error" role="alert">{formError}</p>}
            {message && <p className="success-message" role="status">{message}</p>}
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => void saveDraft(false)}>연습 초안 저장</button>
              <button className="primary-button" type="button" onClick={() => void saveDraft(true)}>답변 작성 완료</button>
              <button className="secondary-button" type="button" onClick={() => void savePhrase()}>재사용 표현으로 저장</button>
              {draft && <button className="danger-button" type="button" onClick={() => void deleteDraft()}>초안 삭제</button>}
            </div>
          </section>
          <SourceModelAnswerPanel answers={answers} />
        </>
      )}
      {step === 'complete' && (
        <>
          <section className="card">
            <h2>아직 교정되지 않은 내 연습 답변</h2>
            <p className="preserve-lines">{draft?.original_input ?? input}</p>
          </section>
          <SourceModelAnswerPanel answers={answers} />
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => move('write')}>답변 수정</button>
            <button className="primary-button" type="button" onClick={() => move('recall')}>암기 시작</button>
          </div>
        </>
      )}
      {step === 'recall' && (
        !draft ? <EmptyState title="암기할 내 답변이 없습니다" /> : (
          <>
            <section className="card">
              <h2>암기 모드</h2>
              <div className="segmented-control" role="radiogroup" aria-label="Part 2 암기 모드">
                {RECALL_MODES.map((mode) => (
                  <label key={mode.value}>
                    <input type="radio" name="part2-recall-mode" checked={recallMode === mode.value} onChange={() => { setRecallMode(mode.value); setRevealed(false) }} />
                    {mode.label}
                  </label>
                ))}
              </div>
            </section>
            <section className="card recall-stage">
              {recallMode !== 'question_only' && <Part2VisualImage asset={asset} setNumber={number} />}
              {recallMode !== 'visual_only' && (
                <LanguageBlock
                  label="회상 질문"
                  language={{ zh: question.question_zh, pinyin: question.question_pinyin, ko: question.question_ko }}
                />
              )}
              {recallMode === 'full' && <p className="preserve-lines">{draft.original_input}</p>}
              {!revealed && recallMode !== 'full' && <p>답변을 머릿속으로 또는 소리 내어 말해 보세요.</p>}
              {!revealed && <button className="primary-button" type="button" onClick={() => setRevealed(true)}>내 답변 보기</button>}
              {revealed && recallMode !== 'full' && <p className="preserve-lines">{draft.original_input}</p>}
            </section>
            {revealed && (
              <section className="card">
                <h2>어떻게 말했나요?</h2>
                <div className="status-button-group">
                  {RECALL_RESULTS.map((result) => (
                    <button key={result.value} type="button" onClick={() => void recordRecall(result.value)}>{result.label}</button>
                  ))}
                </div>
              </section>
            )}
            {message && <p className="success-message" role="status">{message}</p>}
          </>
        )
      )}
    </div>
  )
}
