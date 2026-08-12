import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { saveLastVisualLearningLocation } from '../../app/lastLearningLocation'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
import type { ReviewState } from '../../domain/entities'
import { Part2VisualImage } from './Part2VisualImage'
import { SourceModelAnswerPanel } from './SourceModelAnswerPanel'

const REVIEW_STATUSES: ReviewState['learning_status'][] = [
  '못 외움',
  '헷갈림',
  '외움',
]
const setNumber = (visualSetId: string) =>
  Number(visualSetId.match(/V(\d+)$/)?.[1] ?? 0)

export function VisualQuestionScreen() {
  const { visualQuestionId = '' } = useParams()
  const { publicRepository, userRepository } = useAppDependencies()
  const [reviewOverride, setReviewOverride] = useState<ReviewState>()
  const { data, error, loading } = useAsyncData(async () => {
    const question =
      await publicRepository.getVisualQuestionById(visualQuestionId)
    if (!question) return undefined
    const [visualSet, questions, assets, answers, draft, review] =
      await Promise.all([
        publicRepository.getVisualSetById(question.visual_set_id),
        publicRepository.listVisualQuestionsBySetId(question.visual_set_id),
        publicRepository.listVisualAssetsBySetId(question.visual_set_id),
        publicRepository.listModelAnswersByVisualQuestionId(visualQuestionId),
        userRepository.getPracticeDraftByTarget(
          'visual_question',
          visualQuestionId,
        ),
        userRepository.getReviewState('visual_question', visualQuestionId),
      ])
    return {
      question,
      visualSet,
      questions,
      asset: assets[0],
      answers,
      draft,
      review,
    }
  }, [publicRepository, userRepository, visualQuestionId])

  useEffect(() => {
    if (!data?.visualSet) return
    saveLastVisualLearningLocation({
      last_visual_set_id: data.visualSet.visual_set_id,
      last_visual_question_id: visualQuestionId,
    })
  }, [data?.visualSet, visualQuestionId])

  if (loading) return <LoadingState message="그림 질문을 불러오는 중입니다" />
  if (error || !data?.visualSet) {
    return <ErrorState title="그림 질문을 찾을 수 없습니다" message={visualQuestionId} />
  }
  const number = setNumber(data.visualSet.visual_set_id)
  const index = data.questions.findIndex(
    (item) => item.visual_question_id === visualQuestionId,
  )
  const previous = data.questions[index - 1]
  const next = data.questions[index + 1]
  const review = reviewOverride ?? data.review

  const saveReview = async (status: ReviewState['learning_status']) => {
    const saved = await userRepository.upsertReviewState({
      review_state_id: `rs-visual-question-${visualQuestionId}`,
      target_type: 'visual_question',
      target_id: visualQuestionId,
      learning_status: status,
    })
    setReviewOverride(saved)
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link className="back-link" to={`/parts/2/sets/${data.visualSet.visual_set_id}`}>
          ← 그림 세트 {number}
        </Link>
        <div className="badge-row">
          <StatusBadge status="development_fixture" />
          <StatusBadge status="review_needed" />
          <StatusBadge status={review?.learning_status ?? 'unstarted'} />
        </div>
        <p className="eyebrow">{visualQuestionId}</p>
        <h1>세부 질문 {data.question.item_number}</h1>
      </header>
      <aside className="notice">
        사용자가 제공한 이름 지정 묶음의 검수 전 그림입니다. 공개 권리 승인과 별개로 현재 배포 설정에서만 사용합니다.
      </aside>
      <section className="card">
        <Part2VisualImage asset={data.asset} setNumber={number} expandable />
      </section>
      <section className="card">
        <LanguageBlock
          label={`세부 질문 ${data.question.item_number}`}
          language={{
            zh: data.question.question_zh,
            pinyin: data.question.question_pinyin,
            ko: data.question.question_ko,
          }}
        />
      </section>
      <nav className="question-navigation" aria-label="세부 질문 이동">
        {previous ? <Link className="secondary-button" to={`/visual-questions/${previous.visual_question_id}`}>이전 질문</Link> : <span />}
        <Link className="secondary-button" to={`/parts/2/sets/${data.visualSet.visual_set_id}`}>질문 목록</Link>
        {next ? <Link className="secondary-button" to={`/visual-questions/${next.visual_question_id}`}>다음 질문</Link> : <span />}
      </nav>
      <Link className="primary-button full-width" to={`/visual-questions/${visualQuestionId}/answer`}>
        {data.draft ? '내 답변 이어서 작성' : '짧게 답변 작성'}
      </Link>
      {data.answers.length > 0 ? (
        <SourceModelAnswerPanel answers={data.answers} />
      ) : (
        <EmptyState title="원본 추천 답변 없음" />
      )}
      <section className="card">
        <h2>복습 상태</h2>
        <div className="status-button-group">
          {REVIEW_STATUSES.map((status) => (
            <button
              key={status}
              className="status-button"
              type="button"
              aria-pressed={review?.learning_status === status}
              onClick={() => void saveReview(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
