import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LanguageBlock } from '../../components/LanguageBlock'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
import type { ReviewState } from '../../domain/entities'
import {
  filterPart4QuestionItems,
  pickRandomQuestion,
  type ReviewFilter,
} from '../part/questionFilters'

const REVIEW_STATUSES: ReviewState['learning_status'][] = [
  '못 외움',
  '헷갈림',
  '외움',
]

export function ReviewScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const [query, setQuery] = useState('')
  const [questionType, setQuestionType] = useState('all')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedQuestionId, setRevealedQuestionId] = useState('')
  const [localReviewStates, setLocalReviewStates] = useState<Record<string, ReviewState>>({})
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
        userAnswer: await userRepository.getUserAnswerByQuestionId(question.question_id),
        modelAnswers:
          await publicRepository.listModelAnswersByQuestionId(question.question_id),
        reviewState: await userRepository.getReviewState(
          'question',
          question.question_id,
        ),
      })),
    )
  }, [publicRepository, userRepository])

  const questionTypes = useMemo(
    () =>
      Array.from(
        new Set(
          (data ?? [])
            .map(({ question }) => question.question_type)
            .filter((type): type is string => Boolean(type)),
        ),
      ).sort((left, right) => left.localeCompare(right, 'ko')),
    [data],
  )

  const filteredData = useMemo(() => {
    if (!data) return []
    const filteredItems = filterPart4QuestionItems(
      data.map((item) => ({
        question: item.question,
        userAnswer: item.userAnswer,
        reviewState:
          localReviewStates[item.question.question_id] ?? item.reviewState,
      })),
      { query, questionType, reviewStatus: reviewFilter },
    )
    const allowedIds = new Set(filteredItems.map(({ question }) => question.question_id))
    return data.filter(({ question }) => allowedIds.has(question.question_id))
  }, [data, localReviewStates, query, questionType, reviewFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<ReviewFilter, number> = {
      all: data?.length ?? 0,
      none: 0,
      '못 외움': 0,
      헷갈림: 0,
      외움: 0,
    }
    for (const item of data ?? []) {
      const state = localReviewStates[item.question.question_id] ?? item.reviewState
      if (state) counts[state.learning_status] += 1
      else counts.none += 1
    }
    return counts
  }, [data, localReviewStates])

  const resetReviewRound = () => {
    setCurrentIndex(0)
    setRevealedQuestionId('')
    setPassedQuestionIds(new Set())
  }

  if (loading) return <LoadingState message="복습 문제를 불러오는 중입니다" />
  if (error || !data) {
    return (
      <ErrorState
        title="복습을 불러오지 못했습니다"
        message="학습 문제와 브라우저 저장소를 확인해 주세요."
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

  const resetRound = () => {
    setCurrentIndex(0)
    setRevealedQuestionId('')
    setPassedQuestionIds(new Set())
    setSaveError('')
  }

  const filterPanel = (
    <section className="card filter-panel" aria-label="복습 문제 찾기">
      <div className="filter-grid">
        <label>
          문제 검색
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              resetReviewRound()
            }}
            placeholder="ID·유형·중국어·한국어"
          />
        </label>
        <label>
          유형 필터
          <select
            value={questionType}
            onChange={(event) => {
              setQuestionType(event.target.value)
              resetReviewRound()
            }}
          >
            <option value="all">전체 유형</option>
            {questionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          복습 상태 필터
          <select
            value={reviewFilter}
            onChange={(event) => {
              setReviewFilter(event.target.value as ReviewFilter)
              resetReviewRound()
            }}
          >
            <option value="all">전체 ({statusCounts.all})</option>
            <option value="none">상태 없음 ({statusCounts.none})</option>
            <option value="못 외움">못 외움 ({statusCounts['못 외움']})</option>
            <option value="헷갈림">헷갈림 ({statusCounts.헷갈림})</option>
            <option value="외움">외움 ({statusCounts.외움})</option>
          </select>
        </label>
      </div>
      <div className="button-row">
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setQuery('')
            setQuestionType('all')
            setReviewFilter('all')
            resetReviewRound()
          }}
        >
          필터 초기화
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={filteredData.length === 0}
          onClick={() => {
            const selected = pickRandomQuestion(filteredData)
            if (!selected) return
            setCurrentIndex(
              filteredData.findIndex(
                ({ question }) => question.question_id === selected.question.question_id,
              ),
            )
            setRevealedQuestionId('')
          }}
        >
          랜덤 복습
        </button>
      </div>
      <p>현재 결과 {filteredData.length}개</p>
    </section>
  )

  if (filteredData.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <p className="eyebrow">REVIEW</p>
          <h1>문제 복습</h1>
        </header>
        {filterPanel}
        <EmptyState
          title="조건에 맞는 복습 문제가 없습니다"
          description="검색어나 필터를 바꿔 주세요."
        />
      </div>
    )
  }

  if (currentIndex >= filteredData.length) {
    return (
      <div className="page">
        <header className="page-header">
          <p className="eyebrow">REVIEW COMPLETE</p>
          <h1>복습 완료</h1>
          <p>현재 조건의 Part 4 문제 {filteredData.length}개를 확인했습니다.</p>
        </header>
        {filterPanel}
        <EmptyState
          title="이번 복습을 완료했습니다"
          description="저장한 상태는 유지되며 다시 시작하면 답변은 다시 숨겨집니다."
          action={
            <div className="button-row">
              <button className="primary-button" type="button" onClick={resetRound}>
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

  const current = filteredData[currentIndex]
  const currentReviewState =
    localReviewStates[current.question.question_id] ?? current.reviewState
  const revealed = revealedQuestionId === current.question.question_id

  const saveReviewState = async (learningStatus: ReviewState['learning_status']) => {
    if (savingStatus) return
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
    if (!passedQuestionIds.has(current.question.question_id)) return
    setSaveError('')
    setRevealedQuestionId('')
    setCurrentIndex((index) => index + 1)
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">REVIEW</p>
        <h1>문제 복습</h1>
        <p>
          {currentIndex + 1} / {filteredData.length}
        </p>
      </header>

      {filterPanel}

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
            <StatusBadge status={currentReviewState?.learning_status ?? 'unstarted'} />
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
        <Link className="text-link" to={`/questions/${current.question.question_id}`}>
          문제 상세 보기
        </Link>
      </section>

      <section className="card review-answer" aria-labelledby="review-answer-heading">
        <h2 id="review-answer-heading">답변 확인</h2>
        {!revealed ? (
          <div className="answer-hidden">
            <p>답변이 숨겨져 있습니다</p>
            <button
              className="primary-button"
              type="button"
              onClick={() => setRevealedQuestionId(current.question.question_id)}
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
