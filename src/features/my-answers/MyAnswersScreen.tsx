import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
import { createNavigationContext } from '../../app/navigationContext'

export function MyAnswersScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const [reloadKey, setReloadKey] = useState(0)
  const [deleteError, setDeleteError] = useState('')
  const { data, error, loading } = useAsyncData(async () => {
    const answers = await userRepository.listUserAnswers()
    return Promise.all(
      answers.map(async (answer) => ({
        answer,
        question: await publicRepository.getQuestionById(answer.question_id),
        reviewState: await userRepository.getReviewState(
          'question',
          answer.question_id,
        ),
      })),
    )
  }, [publicRepository, reloadKey, userRepository])

  const deleteAnswer = async (userAnswerId: string) => {
    if (!window.confirm('이 답변과 연결된 개인 실수를 삭제할까요?')) {
      return
    }
    setDeleteError('')
    try {
      await userRepository.deleteUserAnswer(userAnswerId)
      setReloadKey((value) => value + 1)
    } catch (cause: unknown) {
      console.error(cause)
      setDeleteError('답변을 삭제하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  if (loading) {
    return <LoadingState message="저장한 답변을 불러오는 중입니다" />
  }
  if (error || !data) {
    return (
      <ErrorState
        title="나의 답변을 불러오지 못했습니다"
        message="브라우저 저장소를 확인해 주세요."
      />
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">MY ANSWERS</p>
        <h1>나의 답변</h1>
        <p>교정 결과를 직접 승인해 저장한 답변만 표시합니다.</p>
      </header>

      {deleteError && (
        <p className="field-error" role="alert">
          {deleteError}
        </p>
      )}

      {data.length === 0 ? (
        <EmptyState
          title="아직 저장된 답변이 없습니다"
          description="Part 4 문제에서 답변을 작성하고 교정 결과를 승인해 주세요."
          action={
            <Link className="primary-button" to="/parts/4">
              Part 4 문제로 이동
            </Link>
          }
        />
      ) : (
        <ul className="answer-list" aria-label="저장된 나의 답변">
          {data.map(({ answer, question, reviewState }) => (
            <li key={answer.user_answer_id} className="card answer-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    Part {question?.part ?? 4} · {answer.question_id}
                  </p>
                  <h2>{question?.question_type || '문제 유형 미분류'}</h2>
                </div>
                <StatusBadge
                  status={reviewState?.learning_status ?? 'unstarted'}
                />
              </div>
              {question && (
                <p className="answer-card__question" lang="zh-CN">
                  {question.question_zh}
                </p>
              )}
              <LanguageBlock
                label={`${answer.question_id} 저장 답변`}
                language={{
                  zh: answer.corrected_zh,
                  pinyin: answer.corrected_pinyin,
                  ko: answer.corrected_ko,
                }}
              />
              <p className="timestamp">
                마지막 수정일{' '}
                <time dateTime={answer.updated_at}>{answer.updated_at}</time>
              </p>
              <div className="button-row">
                <Link
                  className="secondary-button"
                  to={`/questions/${answer.question_id}`}
                  state={createNavigationContext('/my-answers')}
                >
                  연결된 문제
                </Link>
                <Link
                  className="secondary-button"
                  to={`/questions/${answer.question_id}/answer`}
                  state={createNavigationContext('/my-answers')}
                >
                  다시 작성
                </Link>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void deleteAnswer(answer.user_answer_id)}
                >
                  답변 삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
