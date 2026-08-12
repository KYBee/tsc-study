import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { saveLastStoryLearningLocation } from '../../app/lastLearningLocation'
import { useAsyncData } from '../../app/useAsyncData'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
import type { ReviewState } from '../../domain/entities'
import { REVIEW_VISUAL_ASSETS_ENABLED } from '../../data/localVisualAssetUrl'
import { StoryGuidePanel } from './StoryGuidePanel'
import { Part7VisualGallery } from './Part7VisualGallery'

const setNumber = (visualSetId: string) =>
  Number(visualSetId.match(/V(\d+)$/)?.[1] ?? 0)
const REVIEW_STATUSES: ReviewState['learning_status'][] = [
  '못 외움',
  '헷갈림',
  '외움',
]

export function Part7SetScreen() {
  const { visualSetId = '' } = useParams()
  const { publicRepository, userRepository } = useAppDependencies()
  const navigate = useNavigate()
  const [reviewOverride, setReviewOverride] = useState<ReviewState>()
  const { data, error, loading } = useAsyncData(async () => {
    const visualSet = await publicRepository.getVisualSetById(visualSetId)
    if (!visualSet || visualSet.part !== 7) return undefined
    const [sets, assets, guide, draft, review, instruction, candidates] =
      await Promise.all([
        publicRepository.listVisualSetsByPart(7),
        publicRepository.listVisualAssetsBySetId(visualSetId),
        publicRepository.getStoryGuideByVisualSetId(visualSetId),
        userRepository.getPracticeDraftByTarget('visual_set', visualSetId),
        userRepository.getReviewState('visual_set', visualSetId),
        publicRepository.getPart7CommonInstruction(),
        publicRepository.listQuestionVisualLinkCandidatesBySetId(visualSetId),
      ])
    return {
      visualSet,
      sets,
      assets,
      guide,
      draft,
      review,
      instruction,
      candidates,
    }
  }, [publicRepository, userRepository, visualSetId])

  useEffect(() => {
    if (data?.visualSet) {
      saveLastStoryLearningLocation({
        last_visual_set_id: data.visualSet.visual_set_id,
      })
    }
  }, [data?.visualSet])

  if (loading) return <LoadingState message="스토리 그림을 불러오는 중입니다" />
  if (error || !data) {
    return <ErrorState title="스토리 그림 세트를 찾을 수 없습니다" message={visualSetId} />
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
  const number = setNumber(visualSetId)
  const index = data.sets.findIndex((item) => item.visual_set_id === visualSetId)
  const previous = data.sets[index - 1]
  const next = data.sets[index + 1]
  const review = reviewOverride ?? data.review

  const saveReview = async (status: ReviewState['learning_status']) => {
    const saved = await userRepository.upsertReviewState({
      review_state_id: `rs-visual-set-${visualSetId}`,
      target_type: 'visual_set',
      target_id: visualSetId,
      learning_status: status,
    })
    setReviewOverride(saved)
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link className="back-link" to="/parts/7">← Part 7 세트 목록</Link>
        <div className="badge-row">
          <StatusBadge status="development_fixture" />
          <StatusBadge status="review_needed" />
          <StatusBadge status={review?.learning_status ?? 'unstarted'} />
        </div>
        <p className="eyebrow">{visualSetId}</p>
        <h1>Part 7 스토리 그림 세트 {number}</h1>
      </header>
      <aside className="notice">
        사용자가 제공한 이름 지정 묶음의 검수 전 그림입니다. 공개 권리 승인과 별개로 현재 배포 설정에서만 사용합니다.
      </aside>
      <section className="card visual-set-main">
        <Part7VisualGallery
          assets={data.assets}
          setNumber={number}
          expandable
        />
      </section>
      {data.instruction && (
        <section className="card">
          <h2>Part 7 공통 안내</h2>
          <p className="source-context">
            전체 Part 7에 공통으로 기록된 지시문이며 이 세트의 확정 Question
            연결을 의미하지 않습니다.
          </p>
          <LanguageBlock
            label="Part 7 공통 안내"
            language={{
              zh: data.instruction.question_zh,
              pinyin: data.instruction.question_pinyin,
            }}
          />
        </section>
      )}
      <StoryGuidePanel guide={data.guide} />
      <details className="card guide-details">
        <summary><h2>데이터 연결 상태</h2></summary>
        <strong>확정 연결 없음</strong>
        <p>이 그림과 원본 문제 번호의 연결은 아직 검수되지 않았습니다.</p>
        <p>검토 후보 {data.candidates.length}건 · 숫자 접미사만 일치 · 검수 필요</p>
      </details>
      <section className="card">
        <h2>내 학습 상태</h2>
        <p>
          {data.draft
            ? data.draft.completion_status === 'completed'
              ? '내 이야기 작성 완료'
              : '내 이야기 작성 중'
            : '아직 내 이야기를 작성하지 않았습니다.'}
        </p>
        <div className="status-button-group">
          {REVIEW_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={review?.learning_status === status}
              onClick={() => void saveReview(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </section>
      <Link
        className="primary-button full-width"
        to={`/parts/7/sets/${visualSetId}/answer`}
      >
        {data.draft ? '내 이야기 이어서 작성' : '내 이야기 만들기'}
      </Link>
      <nav className="question-navigation" aria-label="Part 7 세트 이동">
        {previous ? (
          <Link className="secondary-button" to={`/parts/7/sets/${previous.visual_set_id}`}>이전 세트</Link>
        ) : <span />}
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            const selected = data.sets[Math.floor(Math.random() * data.sets.length)]
            navigate(`/parts/7/sets/${selected.visual_set_id}`)
          }}
        >
          랜덤 세트
        </button>
        {next ? (
          <Link className="secondary-button" to={`/parts/7/sets/${next.visual_set_id}`}>다음 세트</Link>
        ) : <span />}
      </nav>
    </div>
  )
}
