import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { saveLastStoryLearningLocation } from '../../app/lastLearningLocation'
import { useAsyncData } from '../../app/useAsyncData'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LearningStatusButtons } from '../../components/LearningStatusButtons'
import { LoadingState } from '../../components/LoadingState'
import { SimpleAnswerEditor } from '../../components/SimpleAnswerEditor'
import { REVIEW_VISUAL_ASSETS_ENABLED } from '../../data/localVisualAssetUrl'
import { StoryGuidePanel } from './StoryGuidePanel'
import { Part7VisualGallery } from './Part7VisualGallery'

const setNumber = (visualSetId: string) =>
  Number(visualSetId.match(/V(\d+)$/)?.[1] ?? 0)
export function Part7SetScreen() {
  const { visualSetId = '' } = useParams()
  const { publicRepository, userRepository } = useAppDependencies()
  const navigate = useNavigate()
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
  if (data?.visualSet && data.visualSet.visual_set_id !== visualSetId) {
    return <LoadingState message="스토리 그림을 불러오는 중입니다" />
  }
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

  return (
    <div className="page">
      <header className="page-header page-header--compact">
        <Link className="back-link" to="/parts/7">← Part 7 세트 목록</Link>
        <p className="eyebrow">PART 7 · 세트 {number}</p>
        <h1>Part 7 스토리 그림 세트 {number}</h1>
        <p>네 장의 그림을 보고 내 이야기 답변을 저장하세요.</p>
      </header>
      <section className="card visual-set-main">
        <Part7VisualGallery
          assets={data.assets}
          setNumber={number}
          expandable
        />
      </section>
      <section className="card primary-learning-action" aria-labelledby="story-answer-heading">
        <h2 id="story-answer-heading">내 이야기 답변</h2>
        <SimpleAnswerEditor
          key={`answer-${visualSetId}`}
          targetType="visual_set"
          targetId={visualSetId}
          initialDraft={data.draft}
          userRepository={userRepository}
          label="내 이야기 답변"
          placeholder="네 장의 그림을 보고 직접 만든 이야기를 입력하세요."
          rows={8}
        />
      </section>
      <section className="card" aria-labelledby="story-memory-heading">
        <h2 id="story-memory-heading">암기 상태</h2>
        <LearningStatusButtons
          key={`review-${visualSetId}`}
          targetType="visual_set"
          targetId={visualSetId}
          initialReviewState={data.review}
          userRepository={userRepository}
        />
      </section>
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
      <div className="secondary-actions">
        <Link
          className="secondary-button"
          to={`/parts/7/sets/${visualSetId}/answer`}
        >
          이야기 구조 연습하기
        </Link>
        {data.draft && (
          <Link
            className="secondary-button"
            to={`/parts/7/sets/${visualSetId}/recall`}
          >
            암기 연습
          </Link>
        )}
      </div>
      <details className="card details-panel supporting-materials">
        <summary>추가 학습 자료 보기</summary>
        <p className="source-context">
          이 그림은 현재 배포 설정에서 사용하는 검수 전 학습 자료입니다.
        </p>
        {data.instruction && (
          <section>
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
        <details className="guide-details">
          <summary><h2>데이터 연결 상태</h2></summary>
          <strong>확정 연결 없음</strong>
          <p>이 그림과 원본 문제 번호의 연결은 아직 검수되지 않았습니다.</p>
          <p>검토 후보 {data.candidates.length}건 · 숫자 접미사만 일치 · 검수 필요</p>
        </details>
      </details>
    </div>
  )
}
