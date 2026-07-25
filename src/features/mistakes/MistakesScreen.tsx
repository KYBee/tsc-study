import { Link } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'

export function MistakesScreen() {
  const { userRepository } = useAppDependencies()
  const { data, error, loading } = useAsyncData(async () => {
    const [corrections, answers] = await Promise.all([
      userRepository.listPersonalCorrections(),
      userRepository.listUserAnswers(),
    ])
    return Promise.all(
      corrections.map(async (correction) => ({
        correction,
        answer: answers.find(
          (answer) => answer.user_answer_id === correction.user_answer_id,
        ),
        reviewState: await userRepository.getReviewState(
          'correction',
          correction.correction_id,
        ),
      })),
    )
  }, [userRepository])

  if (loading) {
    return <LoadingState message="개인 실수를 불러오는 중입니다" />
  }
  if (error || !data) {
    return (
      <ErrorState
        title="실수 노트를 불러오지 못했습니다"
        message="브라우저 저장소를 확인해 주세요."
      />
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">MISTAKE NOTE</p>
        <h1>실수 노트</h1>
        <p>교정한 답변을 승인해 저장하면서 생긴 개인 오류만 표시합니다.</p>
      </header>

      {data.length === 0 ? (
        <EmptyState
          title="아직 저장된 개인 실수가 없습니다"
          description="교정된 답변을 저장하면 이곳에서 확인할 수 있습니다"
          action={
            <Link className="primary-button" to="/parts/4">
              Part 4 문제로 이동
            </Link>
          }
        />
      ) : (
        <ul className="mistake-list" aria-label="개인 실수 목록">
          {data.map(({ correction, answer, reviewState }) => (
            <li key={correction.correction_id} className="card mistake-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">개인 오류</p>
                  <h2>{correction.error_type}</h2>
                </div>
                {reviewState ? (
                  <StatusBadge status={reviewState.learning_status} />
                ) : (
                  <StatusBadge status="unstarted" />
                )}
              </div>
              <div className="mistake-comparison" lang="zh-CN">
                <div>
                  <span>수정 전</span>
                  <del>{correction.wrong_zh}</del>
                </div>
                <span className="mistake-arrow" aria-hidden="true">
                  ↓
                </span>
                <div>
                  <span>수정 후</span>
                  <ins>{correction.correct_zh}</ins>
                </div>
              </div>
              <p className="mistake-reason">
                <strong>수정 이유</strong>
                {correction.reason}
              </p>
              <dl className="metadata-list">
                <div>
                  <dt>연결된 문제</dt>
                  <dd>{answer?.question_id || '연결 정보 없음'}</dd>
                </div>
                <div>
                  <dt>연결된 UserAnswer</dt>
                  <dd>{correction.user_answer_id}</dd>
                </div>
                <div>
                  <dt>생성일</dt>
                  <dd>
                    <time dateTime={correction.created_at}>
                      {correction.created_at}
                    </time>
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
