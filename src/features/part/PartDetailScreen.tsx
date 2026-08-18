import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { loadLastLearningLocation } from '../../app/lastLearningLocation'
import {
  createNavigationContext,
  type TextPartPath,
} from '../../app/navigationContext'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import {
  filterQuestionItems,
  filterSimpleLearningItems,
  pickRandomQuestion,
  type ReviewFilter,
  type SimpleLearningFilter,
  type WritingFilter,
} from './questionFilters'

const TEXT_PARTS = new Set([1, 3, 4, 5, 6])
const partPath = (part: number) => `/parts/${part}` as TextPartPath
const PART4_RESPONSE_STRUCTURE = ['직접 답변', '이유', '설명 또는 경험', '결론']
const SIMPLE_FILTERS: Array<{ value: SimpleLearningFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'unwritten', label: '미작성' },
  { value: 'completed', label: '작성 완료' },
  { value: '못 외움', label: '못 외움' },
  { value: '외움', label: '외움' },
]

export function PartDetailScreen() {
  const { part: partParam = '' } = useParams()
  const partNumber = Number(partParam)
  const { publicRepository, userRepository } = useAppDependencies()
  const navigate = useNavigate()
  const [simpleFilter, setSimpleFilter] = useState<SimpleLearningFilter>('all')
  const [query, setQuery] = useState('')
  const [questionType, setQuestionType] = useState('all')
  const [reviewStatus, setReviewStatus] = useState<ReviewFilter>('all')
  const [writingStatus, setWritingStatus] = useState<WritingFilter>('all')
  const { data, error, loading } = useAsyncData(async () => {
    if (!TEXT_PARTS.has(partNumber)) return undefined
    const [part, questions, guides, answers, drafts, reviewStates] =
      await Promise.all([
        publicRepository.getPart(partNumber),
        publicRepository.listQuestionsByPart(partNumber),
        publicRepository.listPartGuides(partNumber),
        userRepository.listUserAnswers(),
        userRepository.listPracticeDrafts(),
        userRepository.listReviewStates(),
      ])
    if (!part || part.availability !== 'available') return undefined
    const answerByQuestion = new Map(
      answers.map((answer) => [answer.question_id, answer]),
    )
    const draftByQuestion = new Map(
      drafts
        .filter((draft) => (draft.target_type ?? 'question') === 'question')
        .map((draft) => [draft.target_id ?? draft.question_id, draft]),
    )
    const reviewByQuestion = new Map(
      reviewStates
        .filter((state) => state.target_type === 'question')
        .map((state) => [state.target_id, state]),
    )
    return {
      part,
      questions,
      guides,
      items: questions.map((question) => ({
        question,
        userAnswer: answerByQuestion.get(question.question_id),
        practiceDraft: draftByQuestion.get(question.question_id),
        reviewState: reviewByQuestion.get(question.question_id),
      })),
      lastLocation: loadLastLearningLocation(
        questions.map((question) => question.question_id),
      ),
    }
  }, [partNumber, publicRepository, userRepository])

  const questionTypes = useMemo(
    () =>
      [
        ...new Set(
          data?.items
            .map(({ question }) => question.question_type)
            .filter(Boolean),
        ),
      ].sort((left, right) => left!.localeCompare(right!, 'ko')) as string[],
    [data],
  )
  const detailedFiltered = useMemo(
    () =>
      filterQuestionItems(data?.items ?? [], {
        query,
        questionType,
        reviewStatus,
        writingStatus,
      }),
    [data, query, questionType, reviewStatus, writingStatus],
  )
  const filtered = useMemo(
    () => filterSimpleLearningItems(detailedFiltered, simpleFilter),
    [detailedFiltered, simpleFilter],
  )

  const resetFilters = () => {
    setSimpleFilter('all')
    setQuery('')
    setQuestionType('all')
    setReviewStatus('all')
    setWritingStatus('all')
  }

  const openRandomQuestion = () => {
    const selected = pickRandomQuestion(filtered)
    if (selected) {
      navigate(`/questions/${selected.question.question_id}`, {
        state: createNavigationContext(partPath(partNumber)),
      })
    }
  }

  if (loading) return <LoadingState message={`Part ${partParam} 문제를 불러오는 중입니다`} />
  if (error || !data) {
    return (
      <div className="page">
        <ErrorState
          title="학습할 수 없는 Part입니다"
          message={
            partNumber === 2 || partNumber === 7
              ? '그림 문제는 별도 학습 화면에서 제공합니다.'
              : '텍스트 파트 문제 데이터를 확인해 주세요.'
          }
          action={<Link className="primary-button" to="/">학습 홈</Link>}
        />
      </div>
    )
  }

  const courseGuide = data.guides.find(
    (guide) => guide.course_target_context === 'level_3',
  )
  const workbookGuide = data.guides.find((guide) =>
    guide.part_guide_id.startsWith('part-guide-workbook-'),
  )
  const responseStructure =
    partNumber === 4
      ? PART4_RESPONSE_STRUCTURE
      : courseGuide?.response_structure ?? workbookGuide?.response_structure ?? []

  return (
    <div className="page">
      <header className="page-header page-header--compact">
        <Link className="back-link" to="/">← 학습 홈</Link>
        <p className="eyebrow">PART {partNumber}</p>
        <h1>{data.part.name}</h1>
        <p>{data.questions.length}문제에서 내 답변을 하나씩 채워 보세요.</p>
      </header>

      {data.lastLocation && (
        <Link
          className="secondary-button continue-button"
          to={`/questions/${data.lastLocation.last_question_id}`}
        >
          {data.lastLocation.last_question_id} 이어서 보기
        </Link>
      )}

      <section className="card filter-panel" aria-labelledby="question-filter-heading">
        <div className="section-heading">
          <h2 id="question-filter-heading">문제 찾기</h2>
          <button className="text-button" type="button" onClick={resetFilters}>
            필터 초기화
          </button>
        </div>
        <div className="simple-filter-tabs" role="group" aria-label="기본 학습 필터">
          {SIMPLE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className="filter-chip"
              aria-pressed={simpleFilter === filter.value}
              onClick={() => setSimpleFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <details className="details-panel detailed-filters">
          <summary>상세 필터</summary>
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
              <select value={questionType} onChange={(event) => setQuestionType(event.target.value)}>
                <option value="all">전체</option>
                {questionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
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
        </details>
        <div className="button-row">
          <p className="count-label" aria-live="polite">현재 결과 {filtered.length}개</p>
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
          <h2 id="question-list-heading">문제 {data.questions.length}개</h2>
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="조건에 맞는 문제가 없습니다" description="검색어나 필터를 바꿔 보세요." />
        ) : (
          <ul className="card-list" aria-label={`Part ${partNumber} 문제 목록`}>
            {filtered.map(({ question, userAnswer, practiceDraft, reviewState }) => {
              const answerStatus =
                practiceDraft?.completion_status === 'completed' || userAnswer
                  ? '작성 완료'
                  : practiceDraft
                    ? '작성 중'
                    : '미작성'
              return (
                <li key={question.question_id} className="question-card question-card--simple">
                  <Link
                    to={`/questions/${question.question_id}`}
                    state={createNavigationContext(partPath(partNumber))}
                  >
                    <div className="question-card__meta">
                      <span data-testid="question-id">{question.question_id}</span>
                      <span>{question.question_type || '유형 미분류'}</span>
                    </div>
                    <p className="question-card__zh" lang="zh-CN">{question.question_zh}</p>
                    <p className="question-card__ko" lang="ko">
                      {question.question_ko || '한국어 뜻 제공되지 않음'}
                    </p>
                    <div className="question-card__learning-state">
                      <span>내 답변: {answerStatus}</span>
                      <span>암기: {reviewState?.learning_status ?? '미체크'}</span>
                    </div>
                    <span className="question-card__cta">문제 풀기</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <details className="card details-panel supporting-materials">
        <summary>추가 학습 자료 보기</summary>
        <aside className="notice">
          원본 workbook 기반 Part {partNumber} 검수 전 문제입니다. 답변 예시는 아직 없습니다.
        </aside>
        {responseStructure.length > 0 && (
          <section aria-labelledby="structure-heading">
            <p className="eyebrow">{courseGuide ? '강의 참고 구조' : '문제 원본 구조'}</p>
            <h2 id="structure-heading">권장 답변 구조</h2>
            {courseGuide && (
              <p className="source-context">3급 과정 기반 기초 자료이며 문제별 정답이 아닙니다.</p>
            )}
            <ol className="structure-list">
              {responseStructure.map((step, index) => (
                <li key={`${index}-${step}`}><span>{index + 1}</span>{step}</li>
              ))}
            </ol>
          </section>
        )}
      </details>
    </div>
  )
}
