import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { createNavigationContext } from '../../app/navigationContext'
import { useAppDependencies } from '../../app/dependencies'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { StatusBadge } from '../../components/StatusBadge'
import {
  filterPart4QuestionItems,
  pickRandomQuestion,
  type ReviewFilter,
  type WritingFilter,
} from './questionFilters'

const RESPONSE_STRUCTURE = ['직접 답변', '이유', '설명 또는 경험', '결론']

export function PartDetailScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [questionType, setQuestionType] = useState('all')
  const [reviewStatus, setReviewStatus] = useState<ReviewFilter>('all')
  const [writingStatus, setWritingStatus] = useState<WritingFilter>('all')
  const { data, error, loading } = useAsyncData(async () => {
    const [questions, answers, drafts, reviewStates] = await Promise.all([
      publicRepository.listQuestionsByPart(4),
      userRepository.listUserAnswers(),
      userRepository.listPracticeDrafts(),
      userRepository.listReviewStates(),
    ])
    const answerByQuestion = new Map(
      answers.map((answer) => [answer.question_id, answer]),
    )
    const draftByQuestion = new Map(
      drafts.map((draft) => [draft.question_id, draft]),
    )
    const reviewByQuestion = new Map(
      reviewStates
        .filter((state) => state.target_type === 'question')
        .map((state) => [state.target_id, state]),
    )
    return questions.map((question) => ({
      question,
      userAnswer: answerByQuestion.get(question.question_id),
      practiceDraft: draftByQuestion.get(question.question_id),
      reviewState: reviewByQuestion.get(question.question_id),
    }))
  }, [publicRepository, userRepository])

  const questionTypes = useMemo(
    () =>
      [...new Set(data?.map(({ question }) => question.question_type).filter(Boolean))]
        .sort((left, right) => left!.localeCompare(right!, 'ko')) as string[],
    [data],
  )
  const filtered = useMemo(
    () =>
      filterPart4QuestionItems(data ?? [], {
        query,
        questionType,
        reviewStatus,
        writingStatus,
      }),
    [data, query, questionType, reviewStatus, writingStatus],
  )

  const resetFilters = () => {
    setQuery('')
    setQuestionType('all')
    setReviewStatus('all')
    setWritingStatus('all')
  }

  const openRandomQuestion = () => {
    const selected = pickRandomQuestion(filtered)
    if (selected) {
      navigate(`/questions/${selected.question.question_id}`, {
        state: createNavigationContext('/parts/4'),
      })
    }
  }

  if (loading) return <LoadingState message="Part 4 문제를 불러오는 중입니다" />
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
        원본 workbook 기반 Part 4 50개를 사용하는 검수 전 working fixture입니다.
        모범답안과 전체 AI 교정은 제공하지 않습니다.
      </aside>

      <section className="card filter-panel" aria-labelledby="question-filter-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FIND A QUESTION</p>
            <h2 id="question-filter-heading">문제 찾기</h2>
          </div>
          <button className="text-button" type="button" onClick={resetFilters}>
            필터 초기화
          </button>
        </div>
        <div className="filter-grid">
          <label>
            <span>문제 검색</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="중국어·한국어·ID 검색"
            />
          </label>
          <label>
            <span>유형 필터</span>
            <select
              value={questionType}
              onChange={(event) => setQuestionType(event.target.value)}
            >
              <option value="all">전체</option>
              {questionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>복습 상태 필터</span>
            <select
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value as ReviewFilter)}
            >
              <option value="all">전체</option>
              <option value="none">상태 없음</option>
              <option value="못 외움">못 외움</option>
              <option value="헷갈림">헷갈림</option>
              <option value="외움">외움</option>
            </select>
          </label>
          <label>
            <span>작성 상태 필터</span>
            <select
              value={writingStatus}
              onChange={(event) => setWritingStatus(event.target.value as WritingFilter)}
            >
              <option value="all">전체</option>
              <option value="unwritten">미작성</option>
              <option value="draft">연습 초안 있음</option>
              <option value="approved">교정 완료 답변 있음</option>
            </select>
          </label>
        </div>
        <div className="button-row">
          <p className="count-label" aria-live="polite">
            현재 결과 {filtered.length}개
          </p>
          <button
            className="secondary-button"
            type="button"
            disabled={filtered.length === 0}
            onClick={openRandomQuestion}
          >
            현재 결과에서 랜덤 문제
          </button>
        </div>
      </section>

      <section aria-labelledby="question-list-heading">
        <div className="section-heading">
          <h2 id="question-list-heading">문제 50개</h2>
          <span className="count-label">{data.length}개</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="조건에 맞는 문제가 없습니다"
            description="검색어나 필터를 바꿔 보세요."
          />
        ) : (
          <ul className="card-list" aria-label="Part 4 문제 목록">
            {filtered.map(
              ({ question, userAnswer, practiceDraft, reviewState }) => (
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
                      {practiceDraft && <StatusBadge status="has_draft" />}
                      {userAnswer && <StatusBadge status="has_answer" />}
                      <StatusBadge status={reviewState?.learning_status ?? 'unstarted'} />
                    </div>
                  </Link>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
