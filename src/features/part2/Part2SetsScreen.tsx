import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { REVIEW_VISUAL_ASSETS_ENABLED } from '../../data/localVisualAssetUrl'
import { Part2VisualImage } from './Part2VisualImage'

type SetFilter =
  | 'all'
  | 'unwritten'
  | 'in_progress'
  | 'completed'
  | 'not_memorized'
  | 'confused'
  | 'memorized'

const SIMPLE_FILTERS: Array<{ value: SetFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'unwritten', label: '미작성' },
  { value: 'completed', label: '작성 완료' },
  { value: 'not_memorized', label: '못 외움' },
  { value: 'memorized', label: '외움' },
]

const setNumber = (visualSetId: string) =>
  Number(visualSetId.match(/V(\d+)$/)?.[1] ?? 0)

export function Part2SetsScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<SetFilter>('all')
  const { data, error, loading } = useAsyncData(async () => {
    const [sets, drafts, reviewStates] = await Promise.all([
      publicRepository.listVisualSetsByPart(2),
      userRepository.listPracticeDrafts(),
      userRepository.listReviewStates(),
    ])
    return Promise.all(
      sets.map(async (visualSet) => {
        const [assets, questions] = await Promise.all([
          publicRepository.listVisualAssetsBySetId(visualSet.visual_set_id),
          publicRepository.listVisualQuestionsBySetId(visualSet.visual_set_id),
        ])
        const ids = new Set(questions.map((item) => item.visual_question_id))
        return {
          visualSet,
          asset: assets[0],
          questions,
          drafts: drafts.filter(
            (item) =>
              (item.target_type ?? 'question') === 'visual_question' &&
              ids.has(item.target_id ?? item.question_id),
          ),
          reviews: reviewStates.filter(
            (item) =>
              item.target_type === 'visual_question' &&
              ids.has(item.target_id),
          ),
        }
      }),
    )
  }, [publicRepository, userRepository])

  const filtered = useMemo(
    () =>
      (data ?? []).filter((item) => {
        if (filter === 'all') return true
        if (filter === 'unwritten') return item.drafts.length === 0
        if (filter === 'in_progress') {
          return item.drafts.some(
            (draft) => draft.completion_status !== 'completed',
          )
        }
        if (filter === 'completed') {
          return item.drafts.some(
            (draft) => draft.completion_status === 'completed',
          )
        }
        if (filter === 'not_memorized') {
          return item.reviews.some(
            (review) => review.learning_status === '못 외움',
          )
        }
        if (filter === 'confused') {
          return item.reviews.some(
            (review) => review.learning_status === '헷갈림',
          )
        }
        return item.reviews.some((review) => review.learning_status === '외움')
      }),
    [data, filter],
  )

  if (loading) return <LoadingState message="Part 2 그림 세트를 불러오는 중입니다" />
  if (error || !data) {
    return <ErrorState title="Part 2 데이터를 불러오지 못했습니다" message="개발 fixture를 확인해 주세요." />
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

  const randomSet = () => {
    if (filtered.length === 0) return
    const selected = filtered[Math.floor(Math.random() * filtered.length)]
    navigate(`/parts/2/sets/${selected.visualSet.visual_set_id}`)
  }

  return (
    <div className="page">
      <header className="page-header page-header--compact">
        <Link className="back-link" to="/">← 학습 홈</Link>
        <p className="eyebrow">PART 2</p>
        <h1>그림 보고 답하기</h1>
        <p>그림 세트 12개 · 세부 질문 48개</p>
      </header>
      <section className="card filter-panel">
        <div className="simple-filter-tabs" role="group" aria-label="Part 2 기본 학습 필터">
          {SIMPLE_FILTERS.map((item) => (
            <button
              key={item.value}
              className="filter-chip"
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <details className="details-panel">
          <summary>상세 필터</summary>
          <label className="compact-filter">
            세트 상태
            <select value={filter} onChange={(event) => setFilter(event.target.value as SetFilter)}>
              <option value="all">전체 세트</option>
              <option value="unwritten">미작성</option>
              <option value="in_progress">작성 중</option>
              <option value="completed">작성 완료</option>
              <option value="not_memorized">못 외움</option>
              <option value="confused">헷갈림</option>
              <option value="memorized">외움</option>
            </select>
          </label>
        </details>
        <button className="secondary-button" type="button" disabled={filtered.length === 0} onClick={randomSet}>
          랜덤 세트
        </button>
      </section>
      {filtered.length === 0 ? (
        <EmptyState title="조건에 맞는 그림 세트가 없습니다" />
      ) : (
        <ul className="visual-set-grid" aria-label="Part 2 그림 세트">
          {filtered.map(({ visualSet, asset, questions, drafts, reviews }) => {
            const number = setNumber(visualSet.visual_set_id)
            const memorized = reviews.filter(
              (item) => item.learning_status === '외움',
            ).length
            return (
              <li key={visualSet.visual_set_id} className="card visual-set-card">
                <Link
                  to={`/parts/2/sets/${visualSet.visual_set_id}`}
                  aria-label={`세트 ${number} · 질문 ${questions.length}개 · 내 답변 ${drafts.length} / ${questions.length} · 외움 ${memorized} · 공부하기`}
                >
                  <span className="eyebrow" data-testid="visual-set-id">
                    {visualSet.visual_set_id}
                  </span>
                  <Part2VisualImage asset={asset} setNumber={number} thumbnail />
                  <strong>그림 세트 {number}</strong>
                  <small>질문 {questions.length}개</small>
                  <small>내 답변 {drafts.length} / {questions.length}</small>
                  <small>외움 {memorized}</small>
                  <span className="question-card__cta">공부하기</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <details className="card details-panel supporting-materials">
        <summary>데이터 정보</summary>
        <p>현재 배포 설정에서 사용하는 검수 전 그림 학습 자료입니다.</p>
      </details>
    </div>
  )
}
