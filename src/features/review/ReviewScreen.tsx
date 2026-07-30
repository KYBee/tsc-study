import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
import type {
  LearningTargetType,
  ModelAnswer,
  PracticeDraft,
  Question,
  ReviewState,
  UserAnswer,
  VisualAsset,
  VisualQuestion,
} from '../../domain/entities'
import { Part2VisualImage } from '../part2/Part2VisualImage'
import type { ReviewFilter } from '../part/questionFilters'

const REVIEW_STATUSES: ReviewState['learning_status'][] = [
  '못 외움',
  '헷갈림',
  '외움',
]

type ReviewItemKind = 'text' | 'visual'

interface ReviewItem {
  kind: ReviewItemKind
  targetType: LearningTargetType
  targetId: string
  part: number
  itemType: string
  zh: string
  pinyin?: string
  ko?: string
  detailPath: string
  userAnswer?: UserAnswer
  practiceDraft?: PracticeDraft
  modelAnswers: ModelAnswer[]
  reviewState?: ReviewState
  visualQuestion?: VisualQuestion
  visualAsset?: VisualAsset
  setNumber?: number
}

function matchesReviewFilter(
  item: ReviewItem,
  filter: ReviewFilter,
  localReviewStates: Record<string, ReviewState>,
) {
  if (filter === 'all') return true
  const state = localReviewStates[item.targetId] ?? item.reviewState
  if (filter === 'none') return !state
  return state?.learning_status === filter
}

function pickRandomItem(items: ReviewItem[]) {
  if (items.length === 0) return undefined
  return items[Math.floor(Math.random() * items.length)]
}

export function ReviewScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const [query, setQuery] = useState('')
  const [partFilter, setPartFilter] = useState('all')
  const [itemKindFilter, setItemKindFilter] = useState<'all' | ReviewItemKind>('all')
  const [questionType, setQuestionType] = useState('all')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedTargetId, setRevealedTargetId] = useState('')
  const [localReviewStates, setLocalReviewStates] = useState<Record<string, ReviewState>>({})
  const [passedTargetIds, setPassedTargetIds] = useState<Set<string>>(() => new Set())
  const [saveError, setSaveError] = useState('')
  const [savingStatus, setSavingStatus] =
    useState<ReviewState['learning_status']>()

  const { data, error, loading } = useAsyncData(async () => {
    const textQuestions = (
      await Promise.all(
        [1, 3, 4, 5, 6].map((part) =>
          publicRepository.listQuestionsByPart(part),
        ),
      )
    ).flat()
    const textItems: ReviewItem[] = await Promise.all(
      textQuestions.map(async (question: Question) => ({
        kind: 'text' as const,
        targetType: 'question' as const,
        targetId: question.question_id,
        part: question.part,
        itemType: question.question_type || '유형 미분류',
        zh: question.question_zh,
        pinyin: question.question_pinyin,
        ko: question.question_ko,
        detailPath: `/questions/${question.question_id}`,
        userAnswer: await userRepository.getUserAnswerByQuestionId(question.question_id),
        practiceDraft:
          await userRepository.getPracticeDraftByTarget(
            'question',
            question.question_id,
          ),
        modelAnswers:
          await publicRepository.listModelAnswersByQuestionId(question.question_id),
        reviewState: await userRepository.getReviewState(
          'question',
          question.question_id,
        ),
      })),
    )

    const visualSets = await publicRepository.listVisualSetsByPart(2)
    const visualItems = (
      await Promise.all(
        visualSets.map(async (visualSet) => {
          const [visualQuestions, visualAssets] = await Promise.all([
            publicRepository.listVisualQuestionsBySetId(visualSet.visual_set_id),
            publicRepository.listVisualAssetsBySetId(visualSet.visual_set_id),
          ])
          const setNumber = Number(
            visualSet.visual_set_id.match(/V(\d+)$/)?.[1] ?? 0,
          )
          return Promise.all(
            visualQuestions.map(async (visualQuestion): Promise<ReviewItem> => ({
              kind: 'visual',
              targetType: 'visual_question',
              targetId: visualQuestion.visual_question_id,
              part: 2,
              itemType: '그림 세부 질문',
              zh: visualQuestion.question_zh ?? '',
              pinyin: visualQuestion.question_pinyin,
              ko: visualQuestion.question_ko,
              detailPath: `/visual-questions/${visualQuestion.visual_question_id}`,
              practiceDraft:
                await userRepository.getPracticeDraftByTarget(
                  'visual_question',
                  visualQuestion.visual_question_id,
                ),
              modelAnswers:
                await publicRepository.listModelAnswersByVisualQuestionId(
                  visualQuestion.visual_question_id,
                ),
              reviewState: await userRepository.getReviewState(
                'visual_question',
                visualQuestion.visual_question_id,
              ),
              visualQuestion,
              visualAsset: visualAssets[0],
              setNumber,
            })),
          )
        }),
      )
    ).flat()

    return [...textItems, ...visualItems]
  }, [publicRepository, userRepository])

  const questionTypes = useMemo(
    () =>
      Array.from(new Set((data ?? []).map(({ itemType }) => itemType))).sort(
        (left, right) => left.localeCompare(right, 'ko'),
      ),
    [data],
  )

  const filteredData = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return (data ?? []).filter((item) => {
      if (partFilter !== 'all' && item.part !== Number(partFilter)) return false
      if (itemKindFilter !== 'all' && item.kind !== itemKindFilter) return false
      if (questionType !== 'all' && item.itemType !== questionType) return false
      if (!matchesReviewFilter(item, reviewFilter, localReviewStates)) return false
      if (!normalizedQuery) return true
      return [item.targetId, item.itemType, item.zh, item.ko ?? ''].some(
        (value) => value.toLocaleLowerCase().includes(normalizedQuery),
      )
    })
  }, [
    data,
    itemKindFilter,
    localReviewStates,
    partFilter,
    query,
    questionType,
    reviewFilter,
  ])

  const statusCounts = useMemo(() => {
    const scopedData = (data ?? []).filter(
      (item) =>
        (partFilter === 'all' || item.part === Number(partFilter)) &&
        (itemKindFilter === 'all' || item.kind === itemKindFilter),
    )
    const counts: Record<ReviewFilter, number> = {
      all: scopedData.length,
      none: 0,
      '못 외움': 0,
      헷갈림: 0,
      외움: 0,
    }
    for (const item of scopedData) {
      const state = localReviewStates[item.targetId] ?? item.reviewState
      if (state) counts[state.learning_status] += 1
      else counts.none += 1
    }
    return counts
  }, [data, itemKindFilter, localReviewStates, partFilter])

  const resetReviewRound = () => {
    setCurrentIndex(0)
    setRevealedTargetId('')
    setPassedTargetIds(new Set())
  }

  if (loading) return <LoadingState message="복습 문제를 불러오는 중입니다" />
  if (error || !data) {
    return (
      <ErrorState
        title="복습을 불러오지 못했습니다"
        message="학습 문제와 브라우저 저장소를 확인해 주세요."
      />
    )
  }

  const resetRound = () => {
    resetReviewRound()
    setSaveError('')
  }

  const filterPanel = (
    <section className="card filter-panel" aria-label="복습 문제 찾기">
      <div className="filter-grid">
        <label>
          파트 필터
          <select
            value={partFilter}
            onChange={(event) => {
              setPartFilter(event.target.value)
              resetReviewRound()
            }}
          >
            <option value="all">전체 학습 파트</option>
            {[1, 2, 3, 4, 5, 6].map((part) => (
              <option key={part} value={part}>Part {part}</option>
            ))}
          </select>
        </label>
        <label>
          문제 종류
          <select
            value={itemKindFilter}
            onChange={(event) => {
              setItemKindFilter(event.target.value as 'all' | ReviewItemKind)
              resetReviewRound()
            }}
          >
            <option value="all">전체</option>
            <option value="text">텍스트 문제</option>
            <option value="visual">그림 문제</option>
          </select>
        </label>
        <label>
          문제 검색
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              resetReviewRound()
            }}
            placeholder="ID·유형·중국어·한국어"
          />
        </label>
        <label>
          유형 필터
          <select
            value={questionType}
            onChange={(event) => {
              setQuestionType(event.target.value)
              resetReviewRound()
            }}
          >
            <option value="all">전체 유형</option>
            {questionTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          복습 상태 필터
          <select
            value={reviewFilter}
            onChange={(event) => {
              setReviewFilter(event.target.value as ReviewFilter)
              resetReviewRound()
            }}
          >
            <option value="all">전체 ({statusCounts.all})</option>
            <option value="none">상태 없음 ({statusCounts.none})</option>
            <option value="못 외움">못 외움 ({statusCounts['못 외움']})</option>
            <option value="헷갈림">헷갈림 ({statusCounts.헷갈림})</option>
            <option value="외움">외움 ({statusCounts.외움})</option>
          </select>
        </label>
      </div>
      <div className="button-row">
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setQuery('')
            setPartFilter('all')
            setItemKindFilter('all')
            setQuestionType('all')
            setReviewFilter('all')
            resetReviewRound()
          }}
        >
          필터 초기화
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={filteredData.length === 0}
          onClick={() => {
            const selected = pickRandomItem(filteredData)
            if (!selected) return
            setCurrentIndex(
              filteredData.findIndex(({ targetId }) => targetId === selected.targetId),
            )
            setRevealedTargetId('')
          }}
        >
          랜덤 복습
        </button>
      </div>
      <p>현재 결과 {filteredData.length}개</p>
    </section>
  )

  if (filteredData.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <p className="eyebrow">REVIEW</p>
          <h1>문제 복습</h1>
        </header>
        {filterPanel}
        <EmptyState
          title="조건에 맞는 복습 문제가 없습니다"
          description="검색어나 필터를 바꿔 주세요."
        />
      </div>
    )
  }

  if (currentIndex >= filteredData.length) {
    return (
      <div className="page">
        <header className="page-header">
          <p className="eyebrow">REVIEW COMPLETE</p>
          <h1>복습 완료</h1>
          <p>현재 조건의 문제 {filteredData.length}개를 확인했습니다.</p>
        </header>
        {filterPanel}
        <EmptyState
          title="이번 복습을 완료했습니다"
          description="저장한 상태는 유지되며 다시 시작하면 답변은 다시 숨겨집니다."
          action={
            <div className="button-row">
              <button className="primary-button" type="button" onClick={resetRound}>
                다시 복습
              </button>
              <Link className="secondary-button" to="/">파트 선택</Link>
            </div>
          }
        />
      </div>
    )
  }

  const current = filteredData[currentIndex]
  const currentReviewState =
    localReviewStates[current.targetId] ?? current.reviewState
  const revealed = revealedTargetId === current.targetId

  const saveReviewState = async (learningStatus: ReviewState['learning_status']) => {
    if (savingStatus) return
    setSavingStatus(learningStatus)
    setSaveError('')
    try {
      const saved = await userRepository.upsertReviewState({
        review_state_id: `rs-${current.targetType}-${current.targetId}`,
        target_type: current.targetType,
        target_id: current.targetId,
        learning_status: learningStatus,
      })
      setLocalReviewStates((states) => ({ ...states, [current.targetId]: saved }))
      setPassedTargetIds((targetIds) => new Set(targetIds).add(current.targetId))
    } catch (cause: unknown) {
      console.error(cause)
      setSaveError('복습 상태를 저장하지 못했습니다. 현재 문제에서 다시 시도해 주세요.')
    } finally {
      setSavingStatus(undefined)
    }
  }

  const moveNext = () => {
    if (!passedTargetIds.has(current.targetId)) return
    setSaveError('')
    setRevealedTargetId('')
    setCurrentIndex((index) => index + 1)
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">REVIEW</p>
        <h1>문제 복습</h1>
        <p>{currentIndex + 1} / {filteredData.length}</p>
      </header>

      {filterPanel}

      <section className="card review-question" aria-labelledby="review-question-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {current.kind === 'visual'
                ? `Part 2 · 세트 ${current.setNumber} · 질문 ${current.visualQuestion?.item_number}`
                : `Part ${current.part} · ${current.targetId} · ${current.itemType}`}
            </p>
            <h2 id="review-question-heading">질문을 보고 답을 떠올려 보세요</h2>
          </div>
          <div className="badge-row">
            <StatusBadge status="development_fixture" />
            <StatusBadge status="raw" />
            <StatusBadge status={currentReviewState?.learning_status ?? 'unstarted'} />
          </div>
        </div>
        {current.kind === 'visual' && (
          <Part2VisualImage
            asset={current.visualAsset}
            setNumber={current.setNumber ?? 0}
          />
        )}
        <LanguageBlock
          key={current.targetId}
          label="복습 질문"
          pinyinInitiallyVisible={false}
          language={{ zh: current.zh, pinyin: current.pinyin, ko: current.ko }}
        />
        <Link className="text-link" to={current.detailPath}>문제 상세 보기</Link>
      </section>

      <section className="card review-answer" aria-labelledby="review-answer-heading">
        <h2 id="review-answer-heading">답변 확인</h2>
        {!revealed ? (
          <div className="answer-hidden">
            <p>답변이 숨겨져 있습니다</p>
            <button
              className="primary-button"
              type="button"
              onClick={() => setRevealedTargetId(current.targetId)}
            >
              답변 보기
            </button>
          </div>
        ) : (
          <div className="revealed-answer">
            {current.userAnswer ? (
              <LanguageBlock
                label="나의 답변"
                language={{
                  zh: current.userAnswer.corrected_zh,
                  pinyin: current.userAnswer.corrected_pinyin,
                  ko: current.userAnswer.corrected_ko,
                }}
              />
            ) : current.practiceDraft ? (
              <div className="draft-preview">
                <strong>내 연습 답변</strong>
                <p>{current.practiceDraft.original_input}</p>
              </div>
            ) : <EmptyState title="저장된 내 답변 없음" />}
            {current.kind === 'text' && current.modelAnswers.length === 0 && (
              <EmptyState title="아직 모범답안 없음" />
            )}
            {current.kind === 'visual' && (
              <p className="supporting-text">
                원본 추천 답변은 문제 상세에서 참고할 수 있으며 내 암기 답변으로 자동 사용하지 않습니다.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="review-status-heading">
        <h2 id="review-status-heading">현재 기억 상태</h2>
        <p>상태를 누를 때만 개인 ReviewState가 저장됩니다.</p>
        <div className="status-button-group">
          {REVIEW_STATUSES.map((status) => (
            <button
              key={status}
              className="status-button"
              type="button"
              aria-pressed={currentReviewState?.learning_status === status}
              disabled={Boolean(savingStatus)}
              onClick={() => void saveReviewState(status)}
            >
              {savingStatus === status ? '저장 중…' : status}
            </button>
          ))}
        </div>
        {saveError && <p className="field-error" role="alert">{saveError}</p>}
      </section>

      <button
        className="secondary-button full-width"
        type="button"
        onClick={moveNext}
        disabled={Boolean(savingStatus) || !passedTargetIds.has(current.targetId)}
      >
        다음 문제
      </button>
    </div>
  )
}
