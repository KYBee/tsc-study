import { useMemo, useState, type FormEvent } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import {
  createNavigationContext,
  getSafeReturnPath,
  type SafeReturnPath,
} from '../../app/navigationContext'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
import type {
  InputLanguage,
  Part4AnswerSection,
  Part4PlanningKeywords,
  Part4StructuredAnswer,
  RecallMode,
  RecallResult,
} from '../../domain/entities'
import type {
  StoredPracticeDraft,
  StoredReusablePhrase,
} from '../../data/userDataRepository'
import {
  createCorrectionSession,
  loadCorrectionSession,
  saveCorrectionSession,
} from './correctionSession'
import {
  createEmptyPart4DraftContent,
  getDraftFullText,
  joinStructuredAnswer,
  mapRecallResultToReviewStatus,
} from './part4AnswerDraft'
import { GenericAnswerEditorContent } from './GenericAnswerEditorContent'

type LearningStep = 'design' | 'write' | 'complete' | 'recall'
type WritingMode = 'structured' | 'full'

const SECTION_META: Array<{
  key: Part4AnswerSection
  title: string
  keywordLabel: string
  sentenceLabel: string
  phraseType: 'reason' | 'experience' | 'example' | 'conclusion' | 'other'
}> = [
  {
    key: 'direct_answer',
    title: '1. 직접 답변',
    keywordLabel: '직접 답변 키워드',
    sentenceLabel: '직접 답변 문장',
    phraseType: 'other',
  },
  {
    key: 'reasons',
    title: '2. 이유',
    keywordLabel: '이유 키워드',
    sentenceLabel: '이유 문장',
    phraseType: 'reason',
  },
  {
    key: 'example',
    title: '3. 경험 또는 예시',
    keywordLabel: '경험 또는 예시 키워드',
    sentenceLabel: '경험 또는 예시 문장',
    phraseType: 'experience',
  },
  {
    key: 'conclusion',
    title: '4. 마무리',
    keywordLabel: '마무리 키워드',
    sentenceLabel: '마무리 문장',
    phraseType: 'conclusion',
  },
]

const RECALL_MODES: Array<{ value: RecallMode; label: string }> = [
  { value: 'full', label: 'A. 전체 보기' },
  { value: 'chinese_only', label: 'B. 중국어만 보기' },
  { value: 'keywords_only', label: 'C. 키워드만 보기' },
  { value: 'question_only', label: 'D. 질문만 보기' },
]

const RECALL_RESULTS: Array<{ value: RecallResult; label: string }> = [
  { value: 'could_not_say', label: '못 말함' },
  { value: 'used_keywords', label: '키워드 보고 말함' },
  { value: 'almost', label: '거의 말함' },
  { value: 'memorized', label: '외워서 말함' },
]

function inferInputLanguage(value: string): InputLanguage {
  const hasKorean = /[\uac00-\ud7af]/u.test(value)
  const hasChinese = /[\u3400-\u9fff]/u.test(value)
  if (hasKorean && hasChinese) return 'mixed'
  return hasKorean ? 'ko' : 'zh'
}

function parseKeywords(value: string): string[] {
  return value
    .split(/[,\n]/u)
    .map((item) => item.trim())
    .filter(Boolean)
}

function LearningProgress({
  current,
  onMove,
}: {
  current: LearningStep
  onMove: (step: LearningStep) => void
}) {
  const steps: Array<{ value: 'understand' | LearningStep; label: string }> = [
    { value: 'understand', label: '질문 이해' },
    { value: 'design', label: '답변 설계' },
    { value: 'write', label: '답변 작성' },
    { value: 'recall', label: '암기 연습' },
  ]
  return (
    <ol className="learning-progress" aria-label="Part 4 학습 단계">
      {steps.map((step, index) => (
        <li
          key={step.value}
          aria-current={
            step.value === current || (current === 'complete' && step.value === 'write')
              ? 'step'
              : undefined
          }
        >
          <button
            type="button"
            onClick={() => {
              if (step.value === 'understand') window.history.back()
              else onMove(step.value)
            }}
          >
            <span>{index + 1}</span>
            {step.label}
          </button>
        </li>
      ))}
    </ol>
  )
}

export function AnswerEditorScreen() {
  const { questionId = '' } = useParams()
  const location = useLocation()
  const { publicRepository, userRepository, correctionProvider } =
    useAppDependencies()
  const { data, error, loading } = useAsyncData(async () => {
    const question = await publicRepository.getQuestionById(questionId)
    if (!question || ![1, 3, 4, 5, 6].includes(question.part)) {
      return { question: undefined }
    }
    const [answer, practiceDraft, expressions, phrases] = await Promise.all([
      userRepository.getUserAnswerByQuestionId(questionId),
      userRepository.getPracticeDraftByQuestionId(questionId),
      publicRepository.listLearningExpressionsByPart(question.part),
      userRepository.listReusablePhrases(),
    ])
    return { question, answer, practiceDraft, expressions, phrases }
  }, [publicRepository, questionId, userRepository])

  if (loading) return <LoadingState message="답변 학습 화면을 준비하는 중입니다" />
  if (error || !data?.question) {
    return (
      <div className="page">
        <ErrorState
          title={error ? '답변 학습 화면을 불러오지 못했습니다' : '문제를 찾을 수 없습니다'}
          action={
            <Link className="primary-button" to="/">
              학습 홈으로 돌아가기
            </Link>
          }
        />
      </div>
    )
  }

  const returnTo = getSafeReturnPath(
    location.state,
    `/parts/${data.question.part}` as SafeReturnPath,
  )
  if (data.question.part !== 4) {
    return (
      <GenericAnswerEditorContent
        key={questionId}
        question={data.question}
        initialDraft={data.practiceDraft}
        initialPhrases={data.phrases}
        returnTo={returnTo}
        userRepository={userRepository}
      />
    )
  }

  return (
    <AnswerLearningContent
      key={questionId}
      question={data.question}
      initialDraft={data.practiceDraft}
      savedAnswer={data.answer}
      expressions={data.expressions}
      initialPhrases={data.phrases}
      returnTo={returnTo}
      userRepository={userRepository}
      correctionProvider={correctionProvider}
    />
  )
}

function AnswerLearningContent({
  question,
  initialDraft,
  savedAnswer,
  expressions,
  initialPhrases,
  returnTo,
  userRepository,
  correctionProvider,
}: {
  question: NonNullable<
    Awaited<ReturnType<ReturnType<typeof useAppDependencies>['publicRepository']['getQuestionById']>>
  >
  initialDraft?: StoredPracticeDraft
  savedAnswer?: Awaited<
    ReturnType<ReturnType<typeof useAppDependencies>['userRepository']['getUserAnswerByQuestionId']>
  >
  expressions: Awaited<
    ReturnType<
      ReturnType<typeof useAppDependencies>['publicRepository']['listLearningExpressionsByPart']
    >
  >
  initialPhrases: StoredReusablePhrase[]
  returnTo: SafeReturnPath
  userRepository: ReturnType<typeof useAppDependencies>['userRepository']
  correctionProvider: ReturnType<typeof useAppDependencies>['correctionProvider']
}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStep = searchParams.get('step')
  const [step, setStepState] = useState<LearningStep>(
    requestedStep === 'design' ||
      requestedStep === 'complete' ||
      requestedStep === 'recall'
      ? requestedStep
      : 'write',
  )
  const empty = createEmptyPart4DraftContent()
  const [planningKeywords, setPlanningKeywords] = useState<Part4PlanningKeywords>(
    initialDraft?.planning_keywords ?? empty.planning_keywords,
  )
  const [structuredAnswer, setStructuredAnswer] = useState<Part4StructuredAnswer>(
    initialDraft?.structured_answer ?? empty.structured_answer,
  )
  const [fullInput, setFullInput] = useState(
    loadCorrectionSession(question.question_id)?.original_input ??
      initialDraft?.full_text ??
      initialDraft?.original_input ??
      savedAnswer?.original_input ??
      '',
  )
  const [inputLanguage, setInputLanguage] = useState<InputLanguage>(
    initialDraft?.input_language ?? inferInputLanguage(fullInput),
  )
  const [writingMode, setWritingMode] = useState<WritingMode>(
    requestedStep === 'design' ||
      Object.values(initialDraft?.structured_answer ?? {}).some((value) =>
        value.trim(),
      )
      ? 'structured'
      : 'full',
  )
  const [skippedSections, setSkippedSections] = useState<Part4AnswerSection[]>(
    initialDraft?.skipped_sections ?? [],
  )
  const [practiceDraft, setPracticeDraft] = useState(initialDraft)
  const [phrases, setPhrases] = useState(initialPhrases)
  const [recallMode, setRecallMode] = useState<RecallMode>(
    (searchParams.get('mode') as RecallMode) ?? 'full',
  )
  const [answerRevealed, setAnswerRevealed] = useState(false)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const structuredFullText = useMemo(
    () => joinStructuredAnswer(structuredAnswer),
    [structuredAnswer],
  )
  const activeFullText =
    writingMode === 'structured' ? structuredFullText : fullInput
  const navigationState = createNavigationContext(returnTo)

  const moveTo = (next: LearningStep) => {
    setStepState(next)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('step', next)
    setSearchParams(nextParams, { replace: true })
    setMessage('')
    setFormError('')
  }

  const persistDraft = async (completed: boolean) => {
    const text = activeFullText.trim()
    const hasKeywords = Object.values(planningKeywords).some(
      (values) => values.length > 0,
    )
    if (!text && !hasKeywords) {
      setFormError('답변이나 키워드를 입력해 주세요')
      return undefined
    }
    setSaving(true)
    setFormError('')
    try {
      const detectedInputLanguage = inferInputLanguage(text)
      const saved = await userRepository.upsertPracticeDraft({
        practice_draft_id: `pd-${question.question_id}`,
        question_id: question.question_id,
        input_language: detectedInputLanguage,
        original_input: text,
        planning_keywords:
          writingMode === 'structured' ? planningKeywords : initialDraft?.planning_keywords,
        structured_answer:
          writingMode === 'structured' ? structuredAnswer : initialDraft?.structured_answer,
        full_text: text,
        completion_status: completed ? 'completed' : 'in_progress',
        completed_at: completed ? new Date().toISOString() : undefined,
        understanding_confirmed: true,
        skipped_sections: skippedSections,
        draft_status: 'draft',
      })
      setPracticeDraft(saved)
      setMessage(completed ? '답변 작성을 완료했습니다' : '연습 초안을 저장했습니다')
      if (completed) moveTo('complete')
      return saved
    } catch (cause: unknown) {
      console.error(cause)
      setFormError('연습 초안을 저장하지 못했습니다. 입력은 그대로 유지됩니다.')
      return undefined
    } finally {
      setSaving(false)
    }
  }

  const deleteDraft = async () => {
    if (!practiceDraft || !window.confirm('저장된 연습 초안을 삭제할까요?')) return
    await userRepository.deletePracticeDraft(practiceDraft.practice_draft_id)
    setPracticeDraft(undefined)
    setMessage('저장된 연습 초안을 삭제했습니다')
  }

  const submitCorrection = async (event: FormEvent) => {
    event.preventDefault()
    if (!activeFullText.trim() || submitting) {
      setFormError('답변을 입력해 주세요')
      return
    }
    setSubmitting(true)
    const baseSession = createCorrectionSession({
      question_id: question.question_id,
      correction_mode: 'minimal',
      input_language: inputLanguage,
      original_input: activeFullText,
      provider_result: null,
    })
    saveCorrectionSession(baseSession)
    try {
      const providerResult = await correctionProvider.correct({
        question_id: question.question_id,
        part: question.part,
        question_zh: question.question_zh,
        input_language: inputLanguage,
        original_input: activeFullText,
        correction_mode: 'minimal',
      })
      saveCorrectionSession({ ...baseSession, provider_result: providerResult })
    } catch (cause: unknown) {
      console.error(cause)
      saveCorrectionSession({
        ...baseSession,
        provider_result: {
          status: 'failure',
          original_input: activeFullText,
          message: '교정 요청을 처리하지 못했습니다',
          error_code: 'provider_exception',
        },
      })
    }
    navigate(`/questions/${question.question_id}/correction`, {
      state: navigationState,
    })
  }

  const savePhrase = async (
    text: string,
    section: (typeof SECTION_META)[number],
  ) => {
    if (!text.trim()) {
      setFormError('재사용할 표현을 먼저 입력해 주세요')
      return
    }
    const id = `rp-${question.question_id}-${String(phrases.length + 1).padStart(3, '0')}`
    const saved = await userRepository.upsertReusablePhrase({
      reusable_phrase_id: id,
      text,
      language: inferInputLanguage(text),
      phrase_type: section.phraseType,
      source_kind: 'user_created',
      source_question_id: question.question_id,
    })
    setPhrases((current) => [...current.filter((item) => item.reusable_phrase_id !== id), saved])
    setMessage('내 재사용 표현으로 저장했습니다')
  }

  const deletePhrase = async (phraseId: string) => {
    await userRepository.deleteReusablePhrase(phraseId)
    setPhrases((current) =>
      current.filter((phrase) => phrase.reusable_phrase_id !== phraseId),
    )
    setMessage('재사용 표현을 삭제했습니다')
  }

  const recordRecall = async (result: RecallResult) => {
    if (!practiceDraft && !savedAnswer) return
    const timestamp = new Date().toISOString()
    await userRepository.addRecallAttempt({
      recall_attempt_id: `ra-${question.question_id}-${timestamp}`,
      question_id: question.question_id,
      practice_draft_id: practiceDraft?.practice_draft_id,
      user_answer_id: savedAnswer?.user_answer_id,
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
        <p className="eyebrow">{question.question_id}</p>
        <h1>
          {step === 'design'
            ? '답변 설계'
            : step === 'write'
              ? '답변 작성'
              : step === 'complete'
                ? '내가 작성한 연습 답변'
                : '암기 연습'}
        </h1>
        <p>내가 입력한 내용만 저장하며 중국어·병음·번역을 자동 생성하지 않습니다.</p>
      </header>

      <LearningProgress current={step} onMove={moveTo} />

      {step === 'design' && (
        <>
          <section className="card" aria-labelledby="design-heading">
            <h2 id="design-heading">짧은 키워드로 답변 뼈대 만들기</h2>
            <p>쉼표나 줄바꿈으로 직접 구분한 키워드만 저장합니다.</p>
            <div className="answer-section-list">
              {SECTION_META.map((section) => (
                <fieldset key={section.key} className="answer-section-card">
                  <legend>{section.title}</legend>
                  <label>
                    {section.keywordLabel}
                    <textarea
                      rows={2}
                      value={planningKeywords[section.key].join(', ')}
                      onChange={(event) =>
                        setPlanningKeywords((current) => ({
                          ...current,
                          [section.key]: event.target.value
                            ? [event.target.value]
                            : [],
                        }))
                      }
                      onBlur={(event) =>
                        setPlanningKeywords((current) => ({
                          ...current,
                          [section.key]: parseKeywords(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label className="check-option">
                    <input
                      type="checkbox"
                      checked={skippedSections.includes(section.key)}
                      onChange={(event) =>
                        setSkippedSections((current) =>
                          event.target.checked
                            ? [...new Set([...current, section.key])]
                            : current.filter((key) => key !== section.key),
                        )
                      }
                    />
                    이 단계 생략
                  </label>
                </fieldset>
              ))}
            </div>
          </section>
          <details className="card">
            <summary>자주 쓰는 표현 보기</summary>
            <p>강의 참고 표현이며 이 문제의 정답이 아닙니다.</p>
            <ul className="plain-list">
              {expressions.slice(0, 8).map((expression) => (
                <li key={expression.expression_id}>
                  <span lang="zh-CN">{expression.language.zh}</span>
                  {expression.language.ko && <small>{expression.language.ko}</small>}
                </li>
              ))}
            </ul>
          </details>
          {phrases.length > 0 && (
            <details className="card">
              <summary>내가 저장한 재사용 표현</summary>
              <ul className="plain-list">
                {phrases.map((phrase) => (
                  <li key={phrase.reusable_phrase_id}>
                    <span>{phrase.text}</span>{' '}
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => void deletePhrase(phrase.reusable_phrase_id)}
                    >
                      표현 삭제
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="sticky-action">
            <button className="primary-button" type="button" onClick={() => moveTo('write')}>
              답변 작성으로
            </button>
          </div>
        </>
      )}

      {step === 'write' && (
        <form onSubmit={submitCorrection}>
          <section className="card">
            <fieldset className="compact-options">
              <legend>입력 방식</legend>
              {([
                ['ko', '한국어로 먼저 작성'],
                ['zh', '중국어로 직접 작성'],
                ['mixed', '한국어와 중국어 혼합'],
              ] as const).map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="input-language"
                    checked={inputLanguage === value}
                    onChange={() => setInputLanguage(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            {inputLanguage === 'ko' && (
              <p className="notice">
                현재는 답변 내용과 구조를 먼저 저장합니다. 중국어 변환과 교정은 실제
                AI 연결 후 제공됩니다.
              </p>
            )}
            <fieldset className="compact-options">
              <legend>작성 방식</legend>
              <label>
                <input
                  type="radio"
                  name="writing-mode"
                  checked={writingMode === 'structured'}
                  onChange={() => setWritingMode('structured')}
                />
                구조별 작성
              </label>
              <label>
                <input
                  type="radio"
                  name="writing-mode"
                  checked={writingMode === 'full'}
                  onChange={() => setWritingMode('full')}
                />
                전체 답변 작성
              </label>
            </fieldset>
          </section>

          {writingMode === 'structured' ? (
            <div className="answer-section-list">
              {SECTION_META.map((section) => (
                <details className="card answer-section-card" key={section.key} open>
                  <summary>{section.title}</summary>
                  {planningKeywords[section.key].length > 0 && (
                    <p className="keyword-line">
                      키워드: {planningKeywords[section.key].join(' · ')}
                    </p>
                  )}
                  <label>
                    {section.sentenceLabel}
                    <textarea
                      rows={3}
                      value={structuredAnswer[section.key]}
                      disabled={skippedSections.includes(section.key)}
                      onChange={(event) => {
                        const value = event.target.value
                        setStructuredAnswer((current) => {
                          const next = {
                            ...current,
                            [section.key]: value,
                          }
                          setInputLanguage(
                            inferInputLanguage(joinStructuredAnswer(next)),
                          )
                          return next
                        })
                      }}
                    />
                  </label>
                  <button
                    className="text-button"
                    type="button"
                    disabled={!structuredAnswer[section.key].trim()}
                    onClick={() => void savePhrase(structuredAnswer[section.key], section)}
                  >
                    재사용 표현으로 저장
                  </button>
                </details>
              ))}
            </div>
          ) : (
            <section className="card form-field">
              <label htmlFor="answer-input">내 답변</label>
              <textarea
                id="answer-input"
                rows={8}
                value={fullInput}
                onChange={(event) => {
                  setFullInput(event.target.value)
                  setInputLanguage(inferInputLanguage(event.target.value))
                  saveCorrectionSession(
                    createCorrectionSession({
                      question_id: question.question_id,
                      correction_mode: 'minimal',
                      input_language: inferInputLanguage(event.target.value),
                      original_input: event.target.value,
                      provider_result: null,
                    }),
                  )
                }}
                placeholder="한국어·중국어 모두 괜찮아요. 틀려도 그대로 적으세요."
              />
            </section>
          )}

          <section className="card answer-preview" aria-label="전체 답변 미리보기">
            <h2>전체 답변 미리보기</h2>
            <p className="preserve-lines">
              {activeFullText || '작성한 문장이 순서대로 여기에 표시됩니다.'}
            </p>
            <p className="field-help">입력하지 않은 연결어는 자동으로 추가하지 않습니다.</p>
          </section>

          {message && <p className="success-message" role="status">{message}</p>}
          {formError && <p className="field-error" role="alert">{formError}</p>}
          <div className="sticky-action button-row">
            <button
              className="secondary-button"
              type="button"
              disabled={saving}
              onClick={() => void persistDraft(false)}
            >
              연습 초안 저장
            </button>
            {practiceDraft && (
              <button className="danger-button" type="button" onClick={() => void deleteDraft()}>
                저장된 초안 삭제
              </button>
            )}
            <button
              className="primary-button"
              type="button"
              disabled={saving}
              onClick={() => void persistDraft(true)}
            >
              답변 작성 완료
            </button>
            <button className="secondary-button" type="submit" disabled={submitting}>
              {submitting ? '교정 중…' : '교정하기'}
            </button>
          </div>
        </form>
      )}

      {step === 'complete' && (
        <>
          <section className="card">
            <p className="eyebrow">아직 교정되지 않은 답변</p>
            <h2>네 단계별 답변</h2>
            {SECTION_META.map((section) => (
              <div key={section.key} className="completion-section">
                <h3>{section.title}</h3>
                <p>{structuredAnswer[section.key] || '생략'}</p>
                {planningKeywords[section.key].length > 0 && (
                  <small>키워드: {planningKeywords[section.key].join(' · ')}</small>
                )}
              </div>
            ))}
            <h2>전체 답변</h2>
            <p className="preserve-lines">{activeFullText || getDraftFullText(practiceDraft!)}</p>
          </section>
          <div className="sticky-action button-row">
            <button className="secondary-button" type="button" onClick={() => moveTo('write')}>
              답변 수정
            </button>
            <button className="primary-button" type="button" onClick={() => moveTo('recall')}>
              암기 시작
            </button>
            <Link className="secondary-button" to="/parts/4">목록으로</Link>
          </div>
        </>
      )}

      {step === 'recall' && (
        <>
          {!practiceDraft && !savedAnswer ? (
            <EmptyState
              title="암기할 저장 답변이 없습니다"
              description="연습 답변을 먼저 저장하고 완료해 주세요."
              action={
                <button className="primary-button" type="button" onClick={() => moveTo('write')}>
                  답변 작성
                </button>
              }
            />
          ) : (
            <>
              <section className="card">
                <fieldset className="recall-mode-grid">
                  <legend>암기 난이도</legend>
                  {RECALL_MODES.map((mode) => (
                    <label key={mode.value}>
                      <input
                        type="radio"
                        name="recall-mode"
                        checked={recallMode === mode.value}
                        onChange={() => {
                          setRecallMode(mode.value)
                          setAnswerRevealed(false)
                        }}
                      />
                      {mode.label}
                    </label>
                  ))}
                </fieldset>
              </section>
              <section className="card recall-stage" aria-live="polite">
                <LanguageBlock
                  label="암기할 질문"
                  language={{ zh: question.question_zh, pinyin: question.question_pinyin, ko: question.question_ko }}
                  pinyinVisible={recallMode === 'full'}
                  koreanVisible={recallMode === 'full'}
                />
                {recallMode === 'keywords_only' && (
                  <div>
                    <h2>키워드</h2>
                    {SECTION_META.map((section) => (
                      <p key={section.key}>
                        <strong>{section.title}:</strong>{' '}
                        {planningKeywords[section.key].join(' · ') || '없음'}
                      </p>
                    ))}
                  </div>
                )}
                {recallMode === 'chinese_only' && !answerRevealed && (
                  <p lang="zh-CN">{getDraftFullText(practiceDraft!)}</p>
                )}
                {recallMode === 'full' && !answerRevealed && (
                  <p className="preserve-lines">{getDraftFullText(practiceDraft!)}</p>
                )}
                {recallMode === 'question_only' && !answerRevealed && (
                  <p>답변을 보지 않고 머릿속으로 또는 소리 내어 말해 보세요.</p>
                )}
                {!answerRevealed ? (
                  <button className="primary-button" type="button" onClick={() => setAnswerRevealed(true)}>
                    답변 보기
                  </button>
                ) : (
                  <>
                    <h2>저장한 답변</h2>
                    <p className="preserve-lines">
                      {practiceDraft ? getDraftFullText(practiceDraft) : savedAnswer?.corrected_zh}
                    </p>
                  </>
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
                <Link className="secondary-button" to="/parts/4">다른 문제</Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
