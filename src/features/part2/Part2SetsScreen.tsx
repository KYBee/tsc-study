import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
import { Part2VisualImage } from './Part2VisualImage'

type SetFilter = 'all' | 'unwritten' | 'in_progress' | 'completed' | 'confused' | 'memorized'

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
  if (!import.meta.env.DEV) {
    return (
      <div className="page">
        <ErrorState
          title="로컬 그림 학습 전용 기능입니다"
          message="그림 공개 권리 검수 전에는 production에서 사용할 수 없습니다."
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
      <header className="page-header">
        <Link className="back-link" to="/">← 학습 홈</Link>
        <div className="badge-row">
          <StatusBadge status="development_fixture" />
          <StatusBadge status="review_needed" />
        </div>
        <p className="eyebrow">PART 2</p>
        <h1>그림 보고 답하기</h1>
        <p>그림 세트 12개 · 세부 질문 48개</p>
      </header>
      <aside className="notice">
        사용자가 제공한 이름 지정 묶음의 검수 전 그림입니다. 현재 로컬 학습에서만 사용합니다.
      </aside>
      <section className="card compact-filter">
        <label>
          세트 상태
          <select value={filter} onChange={(event) => setFilter(event.target.value as SetFilter)}>
            <option value="all">전체 세트</option>
            <option value="unwritten">미작성</option>
            <option value="in_progress">작성 중</option>
            <option value="completed">작성 완료</option>
            <option value="confused">헷갈림</option>
            <option value="memorized">외움</option>
          </select>
        </label>
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
            const completed = drafts.filter(
              (item) => item.completion_status === 'completed',
            ).length
            return (
              <li key={visualSet.visual_set_id} className="card visual-set-card">
                <Link
                  to={`/parts/2/sets/${visualSet.visual_set_id}`}
                  aria-label={`세트 ${number} · 질문 ${questions.length}개 · 작성 ${drafts.length} · 완료 ${completed}`}
                >
                  <span className="eyebrow" data-testid="visual-set-id">
                    {visualSet.visual_set_id}
                  </span>
                  <Part2VisualImage asset={asset} setNumber={number} thumbnail />
                  <strong>그림 세트 {number}</strong>
                  <small>질문 {questions.length}개 · 작성 {drafts.length} · 완료 {completed}</small>
                  <small>
                    헷갈림 {reviews.filter((item) => item.learning_status === '헷갈림').length}
                    {' · '}외움 {reviews.filter((item) => item.learning_status === '외움').length}
                  </small>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
