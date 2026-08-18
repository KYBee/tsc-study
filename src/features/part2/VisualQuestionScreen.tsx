import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { saveLastVisualLearningLocation } from '../../app/lastLearningLocation'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LearningStatusButtons } from '../../components/LearningStatusButtons'
import { LoadingState } from '../../components/LoadingState'
import { SimpleAnswerEditor } from '../../components/SimpleAnswerEditor'
import { Part2VisualImage } from './Part2VisualImage'
import { SourceModelAnswerPanel } from './SourceModelAnswerPanel'

const setNumber = (visualSetId: string) =>
  Number(visualSetId.match(/V(\d+)$/)?.[1] ?? 0)

export function VisualQuestionScreen() {
  const { visualQuestionId = '' } = useParams()
  const { publicRepository, userRepository } = useAppDependencies()
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
  if (
    data?.question &&
    data.question.visual_question_id !== visualQuestionId
  ) {
    return <LoadingState message="그림 질문을 불러오는 중입니다" />
  }
  if (error || !data?.visualSet) {
    return <ErrorState title="그림 질문을 찾을 수 없습니다" message={visualQuestionId} />
  }
  const number = setNumber(data.visualSet.visual_set_id)
  const index = data.questions.findIndex(
    (item) => item.visual_question_id === visualQuestionId,
  )
  const previous = data.questions[index - 1]
  const next = data.questions[index + 1]

  return (
    <div className="page">
      <header className="page-header page-header--compact">
        <Link className="back-link" to={`/parts/2/sets/${data.visualSet.visual_set_id}`}>
          ← 그림 세트 {number}
        </Link>
        <p className="eyebrow">PART 2 · 세트 {number}</p>
        <h1>세부 질문 {data.question.item_number}</h1>
      </header>
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
      <section className="card primary-learning-action" aria-labelledby="visual-answer-heading">
        <h2 id="visual-answer-heading">내 답변</h2>
        <SimpleAnswerEditor
          key={`answer-${visualQuestionId}`}
          targetType="visual_question"
          targetId={visualQuestionId}
          initialDraft={data.draft}
          userRepository={userRepository}
          label="내 답변"
          rows={4}
        />
      </section>
      <section className="card" aria-labelledby="visual-memory-heading">
        <h2 id="visual-memory-heading">암기 상태</h2>
        <LearningStatusButtons
          key={`review-${visualQuestionId}`}
          targetType="visual_question"
          targetId={visualQuestionId}
          initialReviewState={data.review}
          userRepository={userRepository}
        />
      </section>
      <nav className="question-navigation" aria-label="세부 질문 이동">
        {previous ? <Link className="secondary-button" to={`/visual-questions/${previous.visual_question_id}`}>이전 질문</Link> : <span />}
        <Link className="secondary-button" to={`/parts/2/sets/${data.visualSet.visual_set_id}`}>질문 목록</Link>
        {next ? <Link className="secondary-button" to={`/visual-questions/${next.visual_question_id}`}>다음 질문</Link> : <span />}
      </nav>
      <div className="secondary-actions">
        <Link className="secondary-button" to={`/visual-questions/${visualQuestionId}/answer`}>
          자세히 편집하기
        </Link>
        {data.draft && (
          <Link className="secondary-button" to={`/visual-questions/${visualQuestionId}/recall`}>
            암기 연습
          </Link>
        )}
      </div>
      {data.answers.length > 0 ? (
        <SourceModelAnswerPanel answers={data.answers} />
      ) : (
        <EmptyState title="원본 추천 답변 없음" />
      )}
      <details className="card details-panel supporting-materials">
        <summary>데이터 정보</summary>
        <p>그림과 질문의 출처 및 공개 상태는 아직 검수 중입니다.</p>
      </details>
    </div>
  )
}
