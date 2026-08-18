import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { loadLastStoryLearningLocation } from '../../app/lastLearningLocation'
import { useAsyncData } from '../../app/useAsyncData'
import { LocalVisualAssetImage } from '../../components/LocalVisualAssetImage'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { REVIEW_VISUAL_ASSETS_ENABLED } from '../../data/localVisualAssetUrl'

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

const SIMPLE_FILTERS: Array<{ value: SetFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'unwritten', label: '미작성' },
  { value: 'completed', label: '작성 완료' },
  { value: 'not_memorized', label: '못 외움' },
  { value: 'memorized', label: '외움' },
]

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
    navigate(`/parts/7/sets/${selected.visualSet.visual_set_id}`)
  }

  return (
    <div className="page">
      <header className="page-header page-header--compact">
        <Link className="back-link" to="/">← 학습 홈</Link>
        <p className="eyebrow">PART 7</p>
        <h1>스토리 구성하기</h1>
        <p>스토리 그림 12세트 · 내 이야기 순서를 직접 만들고 연습합니다.</p>
      </header>
      <section className="card filter-panel">
        <div className="simple-filter-tabs" role="group" aria-label="Part 7 기본 학습 필터">
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
        </details>
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
          {filtered.map(({ visualSet, asset, draft, review }) => {
            const number = setNumber(visualSet.visual_set_id)
            return (
              <li key={visualSet.visual_set_id} className="card visual-set-card">
                <Link
                  to={`/parts/7/sets/${visualSet.visual_set_id}`}
                  aria-label={`스토리 세트 ${number} · 내 답변: ${draft ? (draft.completion_status === 'completed' ? '작성 완료' : '작성 중') : '미작성'} · 암기: ${review?.learning_status ?? '미체크'} · 공부하기`}
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
                  <small>내 답변: {draft ? (draft.completion_status === 'completed' ? '작성 완료' : '작성 중') : '미작성'}</small>
                  <small>암기: {review?.learning_status ?? '미체크'}</small>
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
        <p>각 세트의 원본 이야기 가이드는 세트 상세에서 확인할 수 있습니다.</p>
      </details>
    </div>
  )
}
