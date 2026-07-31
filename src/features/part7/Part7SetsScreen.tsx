import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { loadLastStoryLearningLocation } from '../../app/lastLearningLocation'
import { useAsyncData } from '../../app/useAsyncData'
import { LocalVisualAssetImage } from '../../components/LocalVisualAssetImage'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'

type SetFilter =
  | 'all'
  | 'unwritten'
  | 'in_progress'
  | 'completed'
  | 'not_memorized'
  | 'confused'
  | 'memorized'

const setNumber = (visualSetId: string) =>
  Number(visualSetId.match(/V(\d+)$/)?.[1] ?? 0)

export function Part7SetsScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<SetFilter>('all')
  const { data, error, loading } = useAsyncData(async () => {
    const [sets, drafts, reviews] = await Promise.all([
      publicRepository.listVisualSetsByPart(7),
      userRepository.listPracticeDrafts(),
      userRepository.listReviewStates(),
    ])
    const items = await Promise.all(
      sets.map(async (visualSet) => ({
        visualSet,
        asset: (
          await publicRepository.listVisualAssetsBySetId(
            visualSet.visual_set_id,
          )
        )[0],
        guide: await publicRepository.getStoryGuideByVisualSetId(
          visualSet.visual_set_id,
        ),
        draft: drafts.find(
          (item) =>
            item.target_type === 'visual_set' &&
            item.target_id === visualSet.visual_set_id,
        ),
        review: reviews.find(
          (item) =>
            item.target_type === 'visual_set' &&
            item.target_id === visualSet.visual_set_id,
        ),
      })),
    )
    return {
      items,
      lastLocation: loadLastStoryLearningLocation(
        sets.map((item) => item.visual_set_id),
      ),
    }
  }, [publicRepository, userRepository])

  const filtered = useMemo(
    () =>
      (data?.items ?? []).filter(({ draft, review }) => {
        if (filter === 'all') return true
        if (filter === 'unwritten') return !draft
        if (filter === 'in_progress') {
          return draft && draft.completion_status !== 'completed'
        }
        if (filter === 'completed') {
          return draft?.completion_status === 'completed'
        }
        if (filter === 'not_memorized') {
          return review?.learning_status === '못 외움'
        }
        if (filter === 'confused') {
          return review?.learning_status === '헷갈림'
        }
        return review?.learning_status === '외움'
      }),
    [data, filter],
  )

  if (loading) return <LoadingState message="Part 7 스토리 그림을 불러오는 중입니다" />
  if (error || !data) {
    return <ErrorState title="Part 7 데이터를 불러오지 못했습니다" message="로컬 학습 자료를 확인해 주세요." />
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
    navigate(`/parts/7/sets/${selected.visualSet.visual_set_id}`)
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link className="back-link" to="/">← 학습 홈</Link>
        <div className="badge-row">
          <StatusBadge status="development_fixture" />
          <StatusBadge status="review_needed" />
        </div>
        <p className="eyebrow">PART 7</p>
        <h1>스토리 구성하기</h1>
        <p>스토리 그림 12세트 · 내 이야기 순서를 직접 만들고 연습합니다.</p>
      </header>
      <aside className="notice">
        원본 workbook에서 추출한 검수 전 그림입니다. 현재 로컬 학습에서만 사용합니다.
      </aside>
      <section className="card compact-filter">
        <label>
          세트 상태
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as SetFilter)}
          >
            <option value="all">전체</option>
            <option value="unwritten">미작성</option>
            <option value="in_progress">작성 중</option>
            <option value="completed">작성 완료</option>
            <option value="not_memorized">못 외움</option>
            <option value="confused">헷갈림</option>
            <option value="memorized">외움</option>
          </select>
        </label>
        <div className="button-row">
          <button
            className="secondary-button"
            type="button"
            disabled={filtered.length === 0}
            onClick={randomSet}
          >
            랜덤 세트
          </button>
          {data.lastLocation && (
            <Link
              className="secondary-button"
              to={`/parts/7/sets/${data.lastLocation.last_visual_set_id}`}
            >
              마지막 학습 이어서
            </Link>
          )}
        </div>
        <p>현재 결과 {filtered.length}개</p>
      </section>
      {filtered.length === 0 ? (
        <EmptyState title="조건에 맞는 스토리 그림이 없습니다" />
      ) : (
        <ul className="visual-set-grid" aria-label="Part 7 스토리 그림 세트">
          {filtered.map(({ visualSet, asset, guide, draft, review }) => {
            const number = setNumber(visualSet.visual_set_id)
            return (
              <li key={visualSet.visual_set_id} className="card visual-set-card">
                <Link
                  to={`/parts/7/sets/${visualSet.visual_set_id}`}
                  aria-label={`스토리 세트 ${number} · ${draft ? (draft.completion_status === 'completed' ? '작성 완료' : '작성 중') : '미작성'} · ${review?.learning_status ?? '상태 없음'}`}
                >
                  <span className="eyebrow" data-testid="story-set-id">
                    {visualSet.visual_set_id}
                  </span>
                  <LocalVisualAssetImage
                    asset={asset}
                    partNumber={7}
                    setNumber={number}
                    thumbnail
                  />
                  <strong>스토리 그림 세트 {number}</strong>
                  <small>
                    {guide ? '원본 가이드 있음' : '원본 가이드 없음'} ·{' '}
                    {draft ? (draft.completion_status === 'completed' ? '작성 완료' : '작성 중') : '미작성'}
                  </small>
                  <small>복습 {review?.learning_status ?? '상태 없음'}</small>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
