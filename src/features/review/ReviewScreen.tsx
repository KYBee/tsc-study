import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
import type { ReviewState } from '../../domain/entities'

const REVIEW_STATUSES: ReviewState['learning_status'][] = [
  '못 외움',
  '헷갈림',
  '외움',
]

export function ReviewScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedQuestionId, setRevealedQuestionId] = useState('')
  const [localReviewStates, setLocalReviewStates] = useState<
    Record<string, ReviewState>
  >({})
  const [passedQuestionIds, setPassedQuestionIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [saveError, setSaveError] = useState('')
  const [savingStatus, setSavingStatus] =
    useState<ReviewState['learning_status']>()
  const { data, error, loading } = useAsyncData(async () => {
    const questions = await publicRepository.listQuestionsByPart(4)
    return Promise.all(
      questions.map(async (question) => ({
        question,
        userAnswer: await userRepository.getUserAnswerByQuestionId(
          question.question_id,
        ),
        modelAnswers:
          await publicRepository.listModelAnswersByQuestionId(
            question.question_id,
          ),
        reviewState: await userRepository.getReviewState(
          'question',
          question.question_id,
        ),
      })),
    )
  }, [publicRepository, userRepository])

  if (loading) {
    return <LoadingState message="복습 문제를 불러오는 중입니다" />
  }
  if (error || !data) {
    return (
      <ErrorState
        title="복습을 불러오지 못했습니다"
        message="개발 fixture와 브라우저 저장소를 확인해 주세요."
      />
    )
  }
  if (data.length === 0) {
    return (
      <div className="page">
        <EmptyState
          title="복습할 문제가 없습니다"
          action={
            <Link className="primary-button" to="/parts/4">
              Part 4 학습하기
            </Link>
          }
        />
      </div>
    )
  }
  if (currentIndex >= data.length) {
    return (
      <div className="page">
        <header className="page-header">
          <p className="eyebrow">REVIEW COMPLETE</p>
          <h1>복습 완료</h1>
          <p>Part 4 개발 표본 6개의 상태 저장을 마쳤습니다.</p>
        </header>
        <EmptyState
          title="이번 복습을 완료했습니다"
          description="저장한 상태는 유지되며 다시 시작하면 답변은 다시 숨겨집니다."
          action={
            <div className="button-row">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setCurrentIndex(0)
                  setRevealedQuestionId('')
                  setPassedQuestionIds(new Set())
                  setSaveError('')
                }}
              >
                다시 복습
              </button>
              <Link className="secondary-button" to="/parts/4">
                Part 4로 이동
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  const current = data[currentIndex]

  const saveReviewState = async (
    learningStatus: ReviewState['learning_status'],
  ) => {
    if (savingStatus) {
      return
    }
    setSavingStatus(learningStatus)
    setSaveError('')
    try {
      const saved = await userRepository.upsertReviewState({
        review_state_id: `rs-question-${current.question.question_id}`,
        target_type: 'question',
        target_id: current.question.question_id,
        learning_status: learningStatus,
      })
      setLocalReviewStates((states) => ({
        ...states,
        [current.question.question_id]: saved,
      }))
      setPassedQuestionIds((questionIds) => {
        const next = new Set(questionIds)
        next.add(current.question.question_id)
        return next
      })
    } catch (cause: unknown) {
      console.error(cause)
      setSaveError('복습 상태를 저장하지 못했습니다. 현재 문제에서 다시 시도해 주세요.')
    } finally {
      setSavingStatus(undefined)
    }
  }

  const moveNext = () => {
    if (!passedQuestionIds.has(current.question.question_id)) {
      return
    }
    setSaveError('')
    setRevealedQuestionId('')
    setCurrentIndex((index) => index + 1)
  }

  const currentReviewState =
    localReviewStates[current.question.question_id] ?? current.reviewState
  const revealed = revealedQuestionId === current.question.question_id

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">REVIEW</p>
        <h1>문제 복습</h1>
        <p>
          {currentIndex + 1} / {data.length}
        </p>
      </header>

      <section className="card review-question" aria-labelledby="review-question-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {current.question.question_id} ·{' '}
              {current.question.question_type || '유형 미분류'}
            </p>
            <h2 id="review-question-heading">질문을 보고 답을 떠올려 보세요</h2>
          </div>
          <div className="badge-row">
            <StatusBadge status="development_fixture" />
            <StatusBadge status="raw" />
            <StatusBadge
              status={currentReviewState?.learning_status ?? 'unstarted'}
            />
          </div>
        </div>
        <LanguageBlock
          key={current.question.question_id}
          label="복습 질문"
          pinyinInitiallyVisible={false}
          language={{
            zh: current.question.question_zh,
            pinyin: current.question.question_pinyin,
            ko: current.question.question_ko,
          }}
        />
      </section>

      <section className="card review-answer" aria-labelledby="review-answer-heading">
        <h2 id="review-answer-heading">답변 확인</h2>
        {!revealed ? (
          <div className="answer-hidden">
            <p>답변이 숨겨져 있습니다</p>
            <button
              className="primary-button"
              type="button"
              onClick={() =>
                setRevealedQuestionId(current.question.question_id)
              }
            >
              답변 보기
            </button>
          </div>
        ) : (
          <div className="revealed-answer">
            {current.userAnswer ? (
              <LanguageBlock
                label="나의 답변"
                language={{
                  zh: current.userAnswer.corrected_zh,
                  pinyin: current.userAnswer.corrected_pinyin,
                  ko: current.userAnswer.corrected_ko,
                }}
              />
            ) : (
              <EmptyState title="저장된 내 답변 없음" />
            )}
            {current.modelAnswers.length === 0 && (
              <EmptyState title="아직 모범답안 없음" />
            )}
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="review-status-heading">
        <h2 id="review-status-heading">현재 기억 상태</h2>
        <p>상태를 누를 때만 개인 ReviewState가 저장됩니다.</p>
        <div className="status-button-group">
          {REVIEW_STATUSES.map((status) => (
            <button
              key={status}
              className="status-button"
              type="button"
              aria-pressed={currentReviewState?.learning_status === status}
              disabled={Boolean(savingStatus)}
              onClick={() => void saveReviewState(status)}
            >
              {savingStatus === status ? '저장 중…' : status}
            </button>
          ))}
        </div>
        {saveError && (
          <p className="field-error" role="alert">
            {saveError}
          </p>
        )}
      </section>

      <button
        className="secondary-button full-width"
        type="button"
        onClick={moveNext}
        disabled={
          Boolean(savingStatus) ||
          !passedQuestionIds.has(current.question.question_id)
        }
      >
        다음 문제
      </button>
    </div>
  )
}
