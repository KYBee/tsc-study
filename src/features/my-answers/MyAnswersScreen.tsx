import { useState } from 'react'
import { Link } from 'react-router-dom'

import { createNavigationContext } from '../../app/navigationContext'
import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'

type AnswerView = 'approved' | 'drafts'

const INPUT_LANGUAGE_LABELS = {
  ko: '한국어',
  zh: '중국어',
  mixed: '한국어·중국어 혼합',
} as const

export function MyAnswersScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const [activeView, setActiveView] = useState<AnswerView>('approved')
  const [reloadKey, setReloadKey] = useState(0)
  const [deleteError, setDeleteError] = useState('')
  const { data, error, loading } = useAsyncData(async () => {
    const [answers, drafts] = await Promise.all([
      userRepository.listUserAnswers(),
      userRepository.listPracticeDrafts(),
    ])
    const approvedItems = await Promise.all(
      answers.map(async (answer) => ({
        answer,
        question: await publicRepository.getQuestionById(answer.question_id),
        reviewState: await userRepository.getReviewState(
          'question',
          answer.question_id,
        ),
      })),
    )
    const draftItems = await Promise.all(
      drafts.map(async (draft) => ({
        draft,
        question: await publicRepository.getQuestionById(draft.question_id),
        reviewState: await userRepository.getReviewState(
          'question',
          draft.question_id,
        ),
      })),
    )
    return { approvedItems, draftItems }
  }, [publicRepository, reloadKey, userRepository])

  const deleteAnswer = async (userAnswerId: string) => {
    if (!window.confirm('이 답변과 연결된 개인 실수를 삭제할까요?')) return
    setDeleteError('')
    try {
      await userRepository.deleteUserAnswer(userAnswerId)
      setReloadKey((value) => value + 1)
    } catch (cause: unknown) {
      console.error(cause)
      setDeleteError('답변을 삭제하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  const deleteDraft = async (practiceDraftId: string) => {
    if (!window.confirm('이 연습 초안을 삭제할까요?')) return
    setDeleteError('')
    try {
      await userRepository.deletePracticeDraft(practiceDraftId)
      setReloadKey((value) => value + 1)
    } catch (cause: unknown) {
      console.error(cause)
      setDeleteError('연습 초안을 삭제하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  if (loading) return <LoadingState message="저장한 답변을 불러오는 중입니다" />
  if (error || !data) {
    return (
      <ErrorState
        title="나의 답변을 불러오지 못했습니다"
        message="브라우저 저장소를 확인해 주세요."
      />
    )
  }

  const { approvedItems, draftItems } = data

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">MY ANSWERS</p>
        <h1>나의 답변</h1>
        <p>교정 완료 답변과 교정 전 연습 초안을 서로 구분해 관리합니다.</p>
      </header>

      <div className="segmented-control" role="tablist" aria-label="답변 종류">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'approved'}
          className={activeView === 'approved' ? 'segmented-control__active' : ''}
          onClick={() => setActiveView('approved')}
        >
          교정 완료 {approvedItems.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'drafts'}
          className={activeView === 'drafts' ? 'segmented-control__active' : ''}
          onClick={() => setActiveView('drafts')}
        >
          연습 초안 {draftItems.length}
        </button>
      </div>

      {deleteError && (
        <p className="field-error" role="alert">
          {deleteError}
        </p>
      )}

      {activeView === 'approved' &&
        (approvedItems.length === 0 ? (
          <EmptyState
            title="아직 교정 완료 답변이 없습니다"
            description="지원되는 mock 교정 결과를 직접 승인하면 이곳에 저장됩니다."
            action={
              <Link className="primary-button" to="/parts/4">
                Part 4 문제로 이동
              </Link>
            }
          />
        ) : (
          <ul className="answer-list" aria-label="교정 완료 답변">
            {approvedItems.map(({ answer, question, reviewState }) => (
              <li key={answer.user_answer_id} className="card answer-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      Part {question?.part ?? 4} · {answer.question_id}
                    </p>
                    <h2>{question?.question_type || '문제 유형 미분류'}</h2>
                  </div>
                  <StatusBadge status={reviewState?.learning_status ?? 'unstarted'} />
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
                  마지막 수정일 <time dateTime={answer.updated_at}>{answer.updated_at}</time>
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
        ))}

      {activeView === 'drafts' &&
        (draftItems.length === 0 ? (
          <EmptyState
            title="아직 연습 초안이 없습니다"
            description="실제 AI가 지원하지 않는 입력도 원문 그대로 초안에 저장할 수 있습니다."
            action={
              <Link className="primary-button" to="/parts/4">
                Part 4 문제로 이동
              </Link>
            }
          />
        ) : (
          <ul className="answer-list" aria-label="연습 초안">
            {draftItems.map(({ draft, question, reviewState }) => (
              <li key={draft.practice_draft_id} className="card answer-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      Part {question?.part ?? 4} · {draft.question_id}
                    </p>
                    <h2>{question?.question_type || '문제 유형 미분류'}</h2>
                  </div>
                  <div className="badge-row">
                    <StatusBadge status="has_draft" />
                    <StatusBadge status={reviewState?.learning_status ?? 'unstarted'} />
                  </div>
                </div>
                {question && (
                  <p className="answer-card__question" lang="zh-CN">
                    {question.question_zh}
                  </p>
                )}
                <div className="draft-preview">
                  <span className="language-label">
                    원본 입력 · {INPUT_LANGUAGE_LABELS[draft.input_language]}
                  </span>
                  <p>{draft.original_input}</p>
                </div>
                <p className="timestamp">
                  마지막 수정일 <time dateTime={draft.updated_at}>{draft.updated_at}</time>
                </p>
                <div className="button-row">
                  <Link
                    className="secondary-button"
                    to={`/questions/${draft.question_id}/answer`}
                    state={createNavigationContext('/my-answers')}
                  >
                    이어서 편집
                  </Link>
                  <Link
                    className="secondary-button"
                    to={`/questions/${draft.question_id}/answer`}
                    state={createNavigationContext('/my-answers')}
                  >
                    mock 교정 시도
                  </Link>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => void deleteDraft(draft.practice_draft_id)}
                  >
                    초안 삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
