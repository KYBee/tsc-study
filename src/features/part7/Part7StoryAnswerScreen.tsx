import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { saveLastStoryLearningLocation } from '../../app/lastLearningLocation'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import type {
  InputLanguage,
  RecallMode,
  RecallResult,
  StoryPoint,
} from '../../domain/entities'
import { REVIEW_VISUAL_ASSETS_ENABLED } from '../../data/localVisualAssetUrl'
import type {
  StoredPracticeDraft,
  UserDataRepository,
} from '../../data/userDataRepository'
import { mapRecallResultToReviewStatus } from '../answer/part4AnswerDraft'
import { StoryGuidePanel } from './StoryGuidePanel'
import { Part7VisualGallery } from './Part7VisualGallery'

const INPUT_LANGUAGES: Array<{ value: InputLanguage; label: string }> = [
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '중국어' },
  { value: 'mixed', label: '혼합' },
]
const RECALL_RESULTS: Array<{ value: RecallResult; label: string }> = [
  { value: 'could_not_say', label: '못 말함' },
  { value: 'used_keywords', label: '이야기 순서를 보고 말함' },
  { value: 'almost', label: '거의 말함' },
  { value: 'memorized', label: '외워서 말함' },
]
const setNumber = (visualSetId: string) =>
  Number(visualSetId.match(/V(\d+)$/)?.[1] ?? 0)

export function Part7StoryAnswerScreen() {
  const { visualSetId = '' } = useParams()
  const { pathname } = useLocation()
  const { publicRepository, userRepository } = useAppDependencies()
  const { data, error, loading } = useAsyncData(async () => {
    const visualSet = await publicRepository.getVisualSetById(visualSetId)
    if (!visualSet || visualSet.part !== 7) return undefined
    const [assets, guide, instruction, draft, phrases] = await Promise.all([
      publicRepository.listVisualAssetsBySetId(visualSetId),
      publicRepository.getStoryGuideByVisualSetId(visualSetId),
      publicRepository.getPart7CommonInstruction(),
      userRepository.getPracticeDraftByTarget('visual_set', visualSetId),
      userRepository.listReusablePhrases(),
    ])
    return {
      visualSet,
      assets,
      guide,
      instruction,
      draft,
      phrases: phrases.filter(
        (item) =>
          item.source_target_type === 'visual_set' &&
          item.source_target_id === visualSetId,
      ),
    }
  }, [publicRepository, userRepository, visualSetId])

  if (loading) return <LoadingState message="내 이야기 화면을 준비하는 중입니다" />
  if (error || !data) {
    return <ErrorState title="스토리 그림을 찾을 수 없습니다" message={visualSetId} />
  }
  if (!REVIEW_VISUAL_ASSETS_ENABLED) {
    return (
      <div className="page">
        <ErrorState
          title="그림 학습이 활성화되지 않았습니다"
          message="이 이미지 학습 자료는 현재 이 배포 환경에서 활성화되어 있지 않습니다."
          action={<Link className="primary-button" to="/">학습 홈</Link>}
        />
      </div>
    )
  }
  return (
    <Part7StoryContent
      key={visualSetId}
      {...data}
      initialStep={pathname.endsWith('/recall') ? 'recall' : 'write'}
      userRepository={userRepository}
    />
  )
}

function Part7StoryContent({
  visualSet,
  assets,
  guide,
  instruction,
  draft: initialDraft,
  phrases: initialPhrases,
  initialStep,
  userRepository,
}: {
  visualSet: NonNullable<
    Awaited<ReturnType<ReturnType<typeof useAppDependencies>['publicRepository']['getVisualSetById']>>
  >
  assets: Awaited<ReturnType<ReturnType<typeof useAppDependencies>['publicRepository']['listVisualAssetsBySetId']>>
  guide: Awaited<ReturnType<ReturnType<typeof useAppDependencies>['publicRepository']['getStoryGuideByVisualSetId']>>
  instruction: Awaited<ReturnType<ReturnType<typeof useAppDependencies>['publicRepository']['getPart7CommonInstruction']>>
  draft?: StoredPracticeDraft
  phrases: Awaited<ReturnType<UserDataRepository['listReusablePhrases']>>
  initialStep: 'write' | 'recall'
  userRepository: UserDataRepository
}) {
  const navigate = useNavigate()
  const visualSetId = visualSet.visual_set_id
  const number = setNumber(visualSetId)
  const [step, setStep] = useState<'write' | 'complete' | 'recall'>(
    initialStep,
  )
  const [draft, setDraft] = useState(initialDraft)
  const [keywordsText, setKeywordsText] = useState(
    initialDraft?.story_keywords?.join('\n') ?? '',
  )
  const [storyPoints, setStoryPoints] = useState<StoryPoint[]>(
    initialDraft?.story_points ?? [],
  )
  const [newPoint, setNewPoint] = useState('')
  const [fullText, setFullText] = useState(
    initialDraft?.full_text ?? initialDraft?.original_input ?? '',
  )
  const [inputLanguage, setInputLanguage] = useState<InputLanguage>(
    initialDraft?.input_language ?? 'ko',
  )
  const [referencePreview, setReferencePreview] = useState(false)
  const [recallMode, setRecallMode] = useState<RecallMode>('story_full')
  const [revealed, setRevealed] = useState(false)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [phrases, setPhrases] = useState(initialPhrases)
  const nextPointNumber = useRef(
    Math.max(
      0,
      ...(initialDraft?.story_points ?? []).map((point) => {
        const value = Number(point.point_id.match(/-(\d+)$/)?.[1])
        return Number.isFinite(value) ? value : 0
      }),
    ) + 1,
  )

  const keywords = keywordsText
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  const normalizedPoints = (points = storyPoints) =>
    points.map((point, index) => ({ ...point, order: index + 1 }))

  const addPoint = (text = newPoint) => {
    if (!text.trim()) return
    const pointId = `sp-${visualSetId}-${String(nextPointNumber.current).padStart(3, '0')}`
    nextPointNumber.current += 1
    setStoryPoints((points) =>
      normalizedPoints([
        ...points,
        {
          point_id: pointId,
          text: text.trim(),
          order: points.length + 1,
        },
      ]),
    )
    setNewPoint('')
  }
  const updatePoint = (index: number, text: string) => {
    setStoryPoints((points) =>
      points.map((point, pointIndex) =>
        pointIndex === index ? { ...point, text } : point,
      ),
    )
  }
  const movePoint = (index: number, offset: -1 | 1) => {
    setStoryPoints((points) => {
      const target = index + offset
      if (target < 0 || target >= points.length) return points
      const next = [...points]
      ;[next[index], next[target]] = [next[target], next[index]]
      return normalizedPoints(next)
    })
  }
  const removePoint = (index: number) => {
    setStoryPoints((points) =>
      normalizedPoints(points.filter((_, pointIndex) => pointIndex !== index)),
    )
  }

  const saveDraft = async (completed: boolean) => {
    if (!fullText.trim() && keywords.length === 0 && storyPoints.length === 0) {
      setFormError('내 키워드, 이야기 포인트 또는 전체 답변을 입력해 주세요')
      return
    }
    const saved = await userRepository.upsertPracticeDraft({
      practice_draft_id: `pd-${visualSetId}`,
      question_id: visualSetId,
      target_type: 'visual_set',
      target_id: visualSetId,
      input_language: inputLanguage,
      original_input: fullText.trim(),
      story_keywords: keywords,
      story_points: normalizedPoints(),
      full_text: fullText.trim(),
      completion_status: completed ? 'completed' : 'in_progress',
      completed_at: completed ? new Date().toISOString() : undefined,
      draft_status: 'draft',
    })
    setDraft(saved)
    saveLastStoryLearningLocation({ last_visual_set_id: visualSetId })
    setMessage(completed ? '답변 작성을 완료했습니다' : '연습 초안을 저장했습니다')
    setFormError('')
    if (completed) setStep('complete')
  }
  const deleteDraft = async () => {
    if (!draft || !window.confirm('저장된 내 이야기를 삭제할까요?')) return
    await userRepository.deletePracticeDraft(draft.practice_draft_id)
    setDraft(undefined)
    setKeywordsText('')
    setStoryPoints([])
    setFullText('')
    setStep('write')
  }
  const savePhrase = async () => {
    if (!fullText.trim()) return
    const id = `rp-${visualSetId}-${String(phrases.length + 1).padStart(3, '0')}`
    const stored = await userRepository.upsertReusablePhrase({
      reusable_phrase_id: id,
      text: fullText.trim(),
      language: inputLanguage,
      phrase_type: 'other',
      source_kind: 'user_created',
      source_question_id: visualSetId,
      source_target_type: 'visual_set',
      source_target_id: visualSetId,
    })
    setPhrases((items) => [...items, stored])
    setMessage('내 재사용 표현으로 저장했습니다')
  }
  const recordRecall = async (result: RecallResult) => {
    if (!draft) return
    const timestamp = new Date().toISOString()
    await userRepository.addRecallAttempt({
      recall_attempt_id: `ra-${visualSetId}-${timestamp}`,
      question_id: visualSetId,
      target_type: 'visual_set',
      target_id: visualSetId,
      practice_draft_id: draft.practice_draft_id,
      recall_mode: recallMode,
      result,
      attempted_at: timestamp,
    })
    await userRepository.upsertReviewState({
      review_state_id: `rs-visual-set-${visualSetId}`,
      target_type: 'visual_set',
      target_id: visualSetId,
      learning_status: mapRecallResultToReviewStatus(result),
      last_reviewed_at: timestamp,
    })
    setMessage('회상 결과와 복습 상태를 저장했습니다')
  }

  const recallModes: Array<{ value: RecallMode; label: string }> = [
    { value: 'story_full', label: '그림 + 내 이야기 포인트 + 내 답변' },
    { value: 'story_visual_points', label: '그림 + 내 이야기 포인트' },
    { value: 'visual_only', label: '그림만' },
    { value: 'story_points_only', label: '내 이야기 포인트만' },
    ...(instruction
      ? [
          {
            value: 'instruction_visual' as const,
            label: '공통 지시문 + 그림',
          },
          {
            value: 'instruction_only' as const,
            label: '공통 지시문만',
          },
        ]
      : []),
  ]

  const showImage = [
    'story_full',
    'story_visual_points',
    'visual_only',
    'instruction_visual',
  ].includes(recallMode)
  const showPoints = ['story_full', 'story_visual_points', 'story_points_only'].includes(
    recallMode,
  )
  const showInstruction = ['instruction_visual', 'instruction_only'].includes(
    recallMode,
  )

  return (
    <div className="page">
      <header className="page-header">
        <Link className="back-link" to={`/parts/7/sets/${visualSetId}`}>← 스토리 그림 세트 {number}</Link>
        <p className="eyebrow">PART 7 · 스토리 그림 {number}</p>
        <h1>
          {step === 'write'
            ? '내 이야기 만들기'
            : step === 'complete'
              ? '내 연습 이야기'
              : '스토리 회상 연습'}
        </h1>
        <p>사용자가 직접 입력한 내용만 저장하며 번역·교정·병음을 생성하지 않습니다.</p>
      </header>
      {step === 'write' && (
        <>
          <section className="card">
            <Part7VisualGallery
              assets={assets}
              setNumber={number}
            />
          </section>
          <StoryGuidePanel
            guide={guide}
            onRequestReference={() => setReferencePreview(true)}
          />
          {referencePreview && guide && (
            <div
              className="visual-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="원본 가이드 참고 미리보기"
            >
              <div className="visual-lightbox__content card">
                <h2>참고할 원본 흐름</h2>
                <p className="preserve-lines">{guide.recommended_flow}</p>
                <p>확인하면 이 원문 전체를 하나의 내 이야기 포인트로 복사합니다. 아직 저장되지는 않습니다.</p>
                <div className="button-row">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      addPoint(guide.recommended_flow)
                      setReferencePreview(false)
                    }}
                  >
                    참고 내용 복사 확인
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setReferencePreview(false)}
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
          <section className="card story-builder">
            <fieldset className="compact-options">
              <legend>입력 언어</legend>
              {INPUT_LANGUAGES.map((item) => (
                <label key={item.value}>
                  <input
                    type="radio"
                    name="part7-input-language"
                    checked={inputLanguage === item.value}
                    onChange={() => setInputLanguage(item.value)}
                  />
                  {item.label}
                </label>
              ))}
            </fieldset>
            {inputLanguage === 'ko' && (
              <p className="notice">
                현재는 이야기 내용과 구조를 저장합니다. 중국어 변환과 교정은 실제 AI 연결 후 제공됩니다.
              </p>
            )}
            <label htmlFor="story-keywords">이야기 핵심 키워드</label>
            <textarea
              id="story-keywords"
              rows={3}
              value={keywordsText}
              onChange={(event) => setKeywordsText(event.target.value)}
              placeholder="한 줄에 하나씩 직접 입력하세요"
            />
            <h2>내 이야기 포인트</h2>
            <p>순서대로 직접 추가하세요. 원본 가이드는 자동으로 들어오지 않습니다.</p>
            <ol className="story-point-list">
              {storyPoints.map((point, index) => (
                <li key={point.point_id}>
                  <label htmlFor={`story-point-${index}`}>
                    이야기 포인트 {index + 1}
                  </label>
                  <textarea
                    id={`story-point-${index}`}
                    rows={2}
                    value={point.text}
                    onChange={(event) => updatePoint(index, event.target.value)}
                  />
                  <div className="button-row">
                    <button
                      className="secondary-button"
                      type="button"
                      aria-label={`${index + 1 === 1 ? '첫 번째' : index + 1 === 2 ? '두 번째' : `${index + 1}번째`} 포인트 위로 이동`}
                      disabled={index === 0}
                      onClick={() => movePoint(index, -1)}
                    >
                      위로
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      aria-label={`${index + 1}번째 포인트 아래로 이동`}
                      disabled={index === storyPoints.length - 1}
                      onClick={() => movePoint(index, 1)}
                    >
                      아래로
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      aria-label={`${index + 1}번째 포인트 삭제`}
                      onClick={() => removePoint(index)}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <label htmlFor="new-story-point">새 이야기 포인트</label>
            <textarea
              id="new-story-point"
              rows={2}
              value={newPoint}
              onChange={(event) => setNewPoint(event.target.value)}
            />
            <button className="secondary-button" type="button" onClick={() => addPoint()}>
              포인트 추가
            </button>
            <label htmlFor="part7-full-answer">내 전체 답변</label>
            <textarea
              id="part7-full-answer"
              rows={8}
              value={fullText}
              onChange={(event) => setFullText(event.target.value)}
              placeholder="한국어·중국어·혼합 입력 모두 괜찮아요."
            />
            {formError && <p className="field-error" role="alert">{formError}</p>}
            {message && <p className="success-message" role="status">{message}</p>}
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => void saveDraft(false)}>연습 초안 저장</button>
              <button className="primary-button" type="button" onClick={() => void saveDraft(true)}>답변 작성 완료</button>
              <button className="secondary-button" type="button" onClick={() => void savePhrase()}>재사용 표현으로 저장</button>
              {draft && <button className="danger-button" type="button" onClick={() => void deleteDraft()}>초안 삭제</button>}
            </div>
          </section>
        </>
      )}
      {step === 'complete' && (
        <>
          <section className="card">
            <h2>아직 교정되지 않은 내 연습 이야기</h2>
            {draft?.story_keywords && (
              <p className="keyword-line">키워드: {draft.story_keywords.join(' · ')}</p>
            )}
            <ol>
              {draft?.story_points?.map((point) => (
                <li key={point.point_id}>{point.text}</li>
              ))}
            </ol>
            <p className="preserve-lines">{draft?.full_text}</p>
          </section>
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => setStep('write')}>답변 수정</button>
            <button className="primary-button" type="button" onClick={() => { setStep('recall'); setRevealed(false) }}>암기 시작</button>
            <Link className="secondary-button" to="/parts/7">다른 문제</Link>
          </div>
        </>
      )}
      {step === 'recall' && (
        !draft ? (
          <EmptyState
            title="암기할 내 이야기가 없습니다"
            action={<button className="primary-button" type="button" onClick={() => setStep('write')}>내 이야기 작성</button>}
          />
        ) : (
          <>
            <section className="card">
              <h2>암기 모드</h2>
              <div className="recall-mode-grid" role="radiogroup" aria-label="Part 7 암기 모드">
                {recallModes.map((mode) => (
                  <label key={mode.value}>
                    <input
                      type="radio"
                      name="part7-recall-mode"
                      checked={recallMode === mode.value}
                      onChange={() => {
                        setRecallMode(mode.value)
                        setRevealed(false)
                      }}
                    />
                    {mode.label}
                  </label>
                ))}
              </div>
            </section>
            <section className="card recall-stage">
              {showImage && (
                <Part7VisualGallery
                  assets={assets}
                  setNumber={number}
                />
              )}
              {showInstruction && instruction && (
                <LanguageBlock
                  label="Part 7 공통 지시문"
                  language={{
                    zh: instruction.question_zh,
                    pinyin: instruction.question_pinyin,
                  }}
                />
              )}
              {showPoints && (
                <div>
                  <h2>내 이야기 포인트</h2>
                  <ol>
                    {draft.story_points?.map((point) => (
                      <li key={point.point_id}>{point.text}</li>
                    ))}
                  </ol>
                </div>
              )}
              {recallMode === 'story_full' && (
                <p className="preserve-lines">{draft.full_text}</p>
              )}
              {!revealed && recallMode !== 'story_full' && (
                <p>그림이나 내 이야기 순서를 보고 직접 말해 보세요.</p>
              )}
              {!revealed && (
                <button className="primary-button" type="button" onClick={() => setRevealed(true)}>내 답변 보기</button>
              )}
              {revealed && recallMode !== 'story_full' && (
                <p className="preserve-lines">{draft.full_text}</p>
              )}
            </section>
            {revealed && (
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
            <button className="secondary-button" type="button" onClick={() => navigate(`/parts/7/sets/${visualSetId}`)}>세트 상세</button>
          </>
        )
      )}
    </div>
  )
}
