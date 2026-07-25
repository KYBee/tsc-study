import { Link, useLocation, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import {
  createNavigationContext,
  getSafeReturnPath,
} from '../../app/navigationContext'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'

export function QuestionScreen() {
  const { questionId = '' } = useParams()
  const location = useLocation()
  const returnTo = getSafeReturnPath(location.state)
  const navigationState = createNavigationContext(returnTo)
  const { publicRepository, userRepository } = useAppDependencies()
  const { data, error, loading } = useAsyncData(async () => {
    const question = await publicRepository.getQuestionById(questionId)
    if (!question || question.part !== 4) {
      return { question: undefined }
    }
    const [answerPoints, modelAnswers, userAnswer, reviewState] =
      await Promise.all([
        publicRepository.listAnswerPointsByQuestionId(questionId),
        publicRepository.listModelAnswersByQuestionId(questionId),
        userRepository.getUserAnswerByQuestionId(questionId),
        userRepository.getReviewState('question', questionId),
      ])
    return {
      question,
      answerPoints,
      modelAnswers,
      userAnswer,
      reviewState,
    }
  }, [publicRepository, questionId, userRepository])

  if (loading) {
    return <LoadingState message="문제를 불러오는 중입니다" />
  }
  if (error) {
    return (
      <ErrorState
        title="문제를 불러오지 못했습니다"
        message="개발 데이터를 확인한 뒤 다시 시도해 주세요."
      />
    )
  }
  if (!data?.question) {
    return (
      <div className="page">
        <ErrorState
          title="문제를 찾을 수 없습니다"
          message={`요청한 question_id(${questionId || '없음'})가 Part 4 fixture에 없습니다.`}
          action={
            <Link className="primary-button" to="/parts/4">
              Part 4로 돌아가기
            </Link>
          }
        />
      </div>
    )
  }

  const { question, answerPoints, modelAnswers, userAnswer, reviewState } = data

  return (
    <div className="page">
      <header className="page-header">
        <Link className="back-link" to={returnTo}>
          {returnTo === '/my-answers' ? '← 나의 답변' : '← Part 4 문제 목록'}
        </Link>
        <div className="badge-row">
          <StatusBadge status="development_fixture" />
          <StatusBadge status="raw" />
          <StatusBadge status={reviewState?.learning_status ?? 'unstarted'} />
        </div>
        <p className="eyebrow">
          {question.question_id} · {question.question_type || '유형 미분류'}
        </p>
        <h1>문제 확인</h1>
      </header>

      <div className="card">
        <LanguageBlock
          label={`${question.question_id} 질문`}
          language={{
            zh: question.question_zh,
            pinyin: question.question_pinyin,
            ko: question.question_ko,
          }}
        />
      </div>

      {answerPoints && answerPoints.length > 0 && (
        <section
          className="card hint-card"
          aria-labelledby="answer-point-heading"
          aria-label="답변 구성 힌트"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">ANSWER POINT</p>
              <h2 id="answer-point-heading">답변 구성 힌트</h2>
            </div>
            <StatusBadge status="review_needed" />
          </div>
          <p className="hint-label">검수 전 원본 포인트</p>
          <ul className="plain-list">
            {answerPoints.map((point) => (
              <li key={point.answer_point_id}>{point.content}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-labelledby="personal-answer-heading">
        <div className="section-heading">
          <h2 id="personal-answer-heading">나의 답변</h2>
          {userAnswer && <StatusBadge status="has_answer" />}
        </div>
        {userAnswer ? (
          <>
            <LanguageBlock
              label="저장한 나의 답변"
              language={{
                zh: userAnswer.corrected_zh,
                pinyin: userAnswer.corrected_pinyin,
                ko: userAnswer.corrected_ko,
              }}
            />
            <div className="button-row">
              <Link
                className="secondary-button"
                to={`/questions/${question.question_id}/answer`}
                state={navigationState}
              >
                다시 작성
              </Link>
              <Link className="text-link" to="/my-answers">
                나의 답변 보기
              </Link>
            </div>
          </>
        ) : (
          <EmptyState
            title="아직 저장된 답변이 없습니다"
            description="틀려도 괜찮아요. 먼저 내 표현으로 답해 보세요."
            action={
              <Link
                className="primary-button"
                to={`/questions/${question.question_id}/answer`}
                state={navigationState}
              >
                내 답변 만들기
              </Link>
            }
          />
        )}
      </section>

      <section className="card" aria-labelledby="model-answer-heading">
        <h2 id="model-answer-heading">모범답안 비교</h2>
        {modelAnswers && modelAnswers.length > 0 ? (
          <p>검수된 모범답안이 있습니다.</p>
        ) : (
          <EmptyState
            title="아직 모범답안 없음"
            description="모범답안 없이도 내 답변 작성과 복습을 계속할 수 있습니다."
          />
        )}
      </section>
    </div>
  )
}
