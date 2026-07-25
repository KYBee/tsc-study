import { Link } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
import { createNavigationContext } from '../../app/navigationContext'

const RESPONSE_STRUCTURE = ['직접 답변', '이유', '설명 또는 경험', '결론']

export function PartDetailScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const { data, error, loading } = useAsyncData(async () => {
    const questions = await publicRepository.listQuestionsByPart(4)
    const personal = await Promise.all(
      questions.map(async (question) => ({
        question,
        userAnswer: await userRepository.getUserAnswerByQuestionId(
          question.question_id,
        ),
        reviewState: await userRepository.getReviewState(
          'question',
          question.question_id,
        ),
      })),
    )
    return personal
  }, [publicRepository, userRepository])

  if (loading) {
    return <LoadingState message="Part 4 문제를 불러오는 중입니다" />
  }
  if (error || !data) {
    return (
      <ErrorState
        title="Part 4를 불러오지 못했습니다"
        message="개발용 fixture를 확인해 주세요."
      />
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link className="back-link" to="/">
          ← 학습 홈
        </Link>
        <div className="badge-row">
          <StatusBadge status="development_fixture" />
          <StatusBadge status="raw" />
        </div>
        <p className="eyebrow">PART 4</p>
        <h1>일상 화제 설명하기</h1>
        <p>직접 답한 뒤 이유와 구체적인 설명을 연결해 말하는 연습입니다.</p>
      </header>

      <section className="card" aria-labelledby="structure-heading">
        <p className="eyebrow">ANSWER STRUCTURE</p>
        <h2 id="structure-heading">권장 답변 구조</h2>
        <ol className="structure-list">
          {RESPONSE_STRUCTURE.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <aside className="notice" aria-label="개발 데이터 안내">
        이 화면은 raw 상태의 Part 4 개발 fixture 6개만 사용합니다. 전체 문제나
        검수 완료 데이터를 뜻하지 않습니다.
      </aside>

      <section aria-labelledby="question-list-heading">
        <div className="section-heading">
          <h2 id="question-list-heading">문제 6개</h2>
          <span className="count-label">{data.length}개</span>
        </div>
        <ul className="card-list" aria-label="Part 4 문제 목록">
          {data.map(({ question, userAnswer, reviewState }) => (
            <li key={question.question_id} className="question-card">
              <Link
                to={`/questions/${question.question_id}`}
                state={createNavigationContext('/parts/4')}
              >
                <div className="question-card__meta">
                  <span data-testid="question-id">{question.question_id}</span>
                  <span>{question.question_type || '유형 미분류'}</span>
                </div>
                <p className="question-card__zh" lang="zh-CN">
                  {question.question_zh}
                </p>
                <p className="question-card__ko" lang="ko">
                  {question.question_ko || '한국어 뜻 제공되지 않음'}
                </p>
                <div className="badge-row">
                  {userAnswer && <StatusBadge status="has_answer" />}
                  <StatusBadge
                    status={reviewState?.learning_status ?? 'unstarted'}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
