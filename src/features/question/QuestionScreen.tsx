import { useEffect, useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { saveLastLearningLocation } from '../../app/lastLearningLocation'
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
import type { ReviewState } from '../../domain/entities'
import { pickRandomQuestion } from '../part/questionFilters'

const DISPLAY_PREFERENCE_KEY = 'tsc-study:part4:question-language-display'
const REVIEW_STATUSES: ReviewState['learning_status'][] = [
  '못 외움',
  '헷갈림',
  '외움',
]

function loadDisplayPreferences() {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(DISPLAY_PREFERENCE_KEY) ?? '{}',
    ) as { pinyin?: boolean; korean?: boolean }
    return {
      pinyin: value.pinyin ?? true,
      korean: value.korean ?? true,
    }
  } catch {
    return { pinyin: true, korean: true }
  }
}

export function QuestionScreen() {
  const { questionId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { publicRepository, userRepository } = useAppDependencies()
  const [display, setDisplay] = useState(loadDisplayPreferences)
  const [reviewOverride, setReviewOverride] = useState<ReviewState>()
  const [reviewError, setReviewError] = useState('')
  const [savingReview, setSavingReview] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const { data, error, loading } = useAsyncData(async () => {
    const question = await publicRepository.getQuestionById(questionId)
    if (!question || ![1, 3, 4, 5, 6].includes(question.part)) {
      return { question: undefined }
    }
    const [
      questions,
      answerPoints,
      modelAnswers,
      userAnswer,
      practiceDraft,
      reviewState,
      partGuides,
      learningExpressions,
      practiceDrills,
      courseInsights,
    ] = await Promise.all([
      publicRepository.listQuestionsByPart(question.part),
      publicRepository.listAnswerPointsByQuestionId(questionId),
      publicRepository.listModelAnswersByQuestionId(questionId),
      userRepository.getUserAnswerByQuestionId(questionId),
      userRepository.getPracticeDraftByQuestionId(questionId),
      userRepository.getReviewState('question', questionId),
      publicRepository.listPartGuides(question.part),
      publicRepository.listLearningExpressionsByPart(question.part),
      publicRepository.listPracticeDrillsByPart(question.part),
      publicRepository.listCourseInsightsByPart(question.part),
    ])
    return {
      question,
      questions,
      answerPoints,
      modelAnswers,
      userAnswer,
      practiceDraft,
      reviewState,
      partGuides,
      learningExpressions,
      practiceDrills,
      courseInsights,
    }
  }, [publicRepository, questionId, userRepository])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DISPLAY_PREFERENCE_KEY,
        JSON.stringify(display),
      )
    } catch {
      // A display preference must never block learning.
    }
  }, [display])

  useEffect(() => {
    if (data?.question && data.questions) {
      saveLastLearningLocation({
        last_part: data.question.part,
        last_question_id: data.question.question_id,
      })
    }
  }, [data])

  if (loading) return <LoadingState message="문제를 불러오는 중입니다" />
  if (error) {
    return (
      <ErrorState
        title="문제를 불러오지 못했습니다"
        message="개발 데이터를 확인한 뒤 다시 시도해 주세요."
      />
    )
  }
  if (!data?.question || !data.questions) {
    return (
      <div className="page">
        <ErrorState
          title="문제를 찾을 수 없습니다"
          message={`요청한 question_id(${questionId || '없음'})가 텍스트 문제에 없습니다.`}
          action={
            <Link
              className="primary-button"
              to={questionId.startsWith('P4-') ? '/parts/4' : '/'}
            >
              {questionId.startsWith('P4-')
                ? 'Part 4로 돌아가기'
                : '학습 홈으로 돌아가기'}
            </Link>
          }
        />
      </div>
    )
  }

  const {
    question,
    questions,
    answerPoints,
    modelAnswers,
    userAnswer,
    practiceDraft,
    partGuides,
    learningExpressions,
    practiceDrills,
    courseInsights,
  } = data
  const returnTo = getSafeReturnPath(
    location.state,
    `/parts/${question.part}` as '/parts/1' | '/parts/3' | '/parts/4' | '/parts/5' | '/parts/6',
  )
  const navigationState = createNavigationContext(returnTo)
  const currentIndex = questions.findIndex(
    (item) => item.question_id === question.question_id,
  )
  const previousQuestion = questions[currentIndex - 1]
  const nextQuestion = questions[currentIndex + 1]
  const currentReviewState = reviewOverride ?? data.reviewState
  const courseGuide = partGuides.find(
    (guide) => guide.course_target_context === 'level_3',
  )
  const workbookGuide = partGuides.find((guide) =>
    guide.part_guide_id.startsWith('part-guide-workbook-'),
  )
  const isPart4 = question.part === 4

  const saveReview = async (learningStatus: ReviewState['learning_status']) => {
    if (savingReview) return
    setSavingReview(true)
    setReviewError('')
    try {
      const saved = await userRepository.upsertReviewState({
        review_state_id: `rs-question-${question.question_id}`,
        target_type: 'question',
        target_id: question.question_id,
        learning_status: learningStatus,
      })
      setReviewOverride(saved)
    } catch (cause: unknown) {
      console.error(cause)
      setReviewError('복습 상태를 저장하지 못했습니다.')
    } finally {
      setSavingReview(false)
    }
  }

  const openRandom = () => {
    const selected = pickRandomQuestion(questions)
    if (selected) {
      navigate(`/questions/${selected.question_id}`, {
        state: navigationState,
      })
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link className="back-link" to={returnTo}>
          {returnTo === '/my-answers'
            ? '← 나의 답변'
            : `← Part ${question.part} 문제 목록`}
        </Link>
        <div className="badge-row">
          <StatusBadge status="development_fixture" />
          <StatusBadge status="raw" />
          <StatusBadge status={currentReviewState?.learning_status ?? 'unstarted'} />
          {practiceDraft && <StatusBadge status="has_draft" />}
          {userAnswer && <StatusBadge status="has_answer" />}
        </div>
        <p className="eyebrow">
          {question.question_id} · {question.question_type || '유형 미분류'}
        </p>
        {isPart4 && <p className="learning-step-label">1단계 · 질문 이해</p>}
        <h1>{isPart4 ? '질문 이해' : `Part ${question.part} 문제`}</h1>
        <p>원본 workbook 기반 검수 전 학습 문제입니다.</p>
      </header>

      {isPart4 && (
        <ol className="learning-progress" aria-label="Part 4 학습 단계">
          {['질문 이해', '답변 설계', '답변 작성', '암기 연습'].map(
            (step, index) => (
              <li key={step} aria-current={index === 0 ? 'step' : undefined}>
                <span>{index + 1}</span>
                {step}
              </li>
            ),
          )}
        </ol>
      )}

      <nav className="question-navigation" aria-label="문제 이동">
        {previousQuestion ? (
          <Link
            className="secondary-button"
            to={`/questions/${previousQuestion.question_id}`}
            state={navigationState}
          >
            이전 문제 · {previousQuestion.question_id}
          </Link>
        ) : (
          <span />
        )}
        <button className="secondary-button" type="button" onClick={openRandom}>
          랜덤 문제
        </button>
        {nextQuestion ? (
          <Link
            className="secondary-button"
            to={`/questions/${nextQuestion.question_id}`}
            state={navigationState}
          >
            다음 문제 · {nextQuestion.question_id}
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <div className="card">
        <LanguageBlock
          label={`${question.question_id} 질문`}
          language={{
            zh: question.question_zh,
            pinyin: question.question_pinyin,
            ko: question.question_ko,
          }}
          pinyinVisible={display.pinyin}
          koreanVisible={display.korean}
          onPinyinVisibilityChange={(pinyin) =>
            setDisplay((current) => ({ ...current, pinyin }))
          }
          onKoreanVisibilityChange={(korean) =>
            setDisplay((current) => ({ ...current, korean }))
          }
        />
      </div>

      <section
        className="card hint-card"
        aria-label="답변 구성 힌트"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">WORKBOOK HINT</p>
            <h2 id="answer-point-heading">문제 원본 힌트</h2>
          </div>
          <StatusBadge status="review_needed" />
        </div>
        {answerPoints.length > 0 ? (
          <>
            <p className="hint-label">검수 전 원본 포인트</p>
            <ul className="plain-list">
              {answerPoints.map((point) => (
                <li key={point.answer_point_id}>{point.content}</li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState title="답변 구성 힌트 없음" />
        )}
      </section>

      {workbookGuide && (
        <details className="card guide-details">
          <summary><h2>문제 원본 가이드</h2></summary>
          {workbookGuide.goal && <p>{workbookGuide.goal}</p>}
          {workbookGuide.response_structure &&
            workbookGuide.response_structure.length > 0 && (
              <ol className="plain-list">
                {workbookGuide.response_structure.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
        </details>
      )}

      {courseGuide && (
        <details className="card guide-details" open={isPart4}>
          <summary>
            <h2>강의 기반 기초 구조</h2>
          </summary>
          <p className="source-context">
            3급 과정 맥락 · 검수 전 강의 분석 자료이며 Level 8 공식 가이드가 아닙니다.
          </p>
          <>
            <p>{courseGuide.goal}</p>
            <ol className="plain-list">
              {courseGuide.response_structure?.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        </details>
      )}

      {learningExpressions.length > 0 && (
        <details className="card guide-details">
          <summary><h2>재사용 표현</h2></summary>
          <p className="source-context">
            Part {question.part} 공통 학습 자료이며 이 문제의 정답이 아닙니다.
          </p>
          <ul className="plain-list">
            {learningExpressions.map((expression) => (
              <li key={expression.expression_id}>
                <span lang="zh-CN">{expression.language.zh}</span>
                {expression.language.ko && <small>{expression.language.ko}</small>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {isPart4 ? (
        <section className="card understanding-action" aria-label="질문 이해 확인">
          <label className="check-option">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
            />
            질문을 이해했습니다
          </label>
          <Link
            className={`primary-button${understood ? '' : ' is-disabled'}`}
            aria-disabled={!understood}
            tabIndex={understood ? undefined : -1}
            to={
              understood
                ? `/questions/${question.question_id}/answer?step=design`
                : location.pathname
            }
            state={navigationState}
          >
            질문 이해 완료
          </Link>
        </section>
      ) : (
        <div className="button-row">
          <Link
            className="primary-button"
            to={`/questions/${question.question_id}/answer`}
            state={navigationState}
          >
            내 답변 작성
          </Link>
          {question.part === 3 && (
            <Link
              className="secondary-button"
              to={`/questions/${question.question_id}/exam`}
            >
              실전 모드 시작
            </Link>
          )}
        </div>
      )}

      {practiceDrills.length > 0 && <details className="card guide-details">
        <summary>
          <h2>실전 연습</h2>
        </summary>
        <ul className="plain-list">
          {practiceDrills.map((drill) => (
            <li key={drill.drill_id}>{drill.prompt_or_task}</li>
          ))}
        </ul>
      </details>}

      {courseInsights.length > 0 && <details className="card guide-details">
        <summary>
          <h2>주의할 실수</h2>
        </summary>
        <ul className="plain-list">
          {courseInsights.map((insight) => (
            <li key={insight.insight_id}>{insight.content_ko}</li>
          ))}
        </ul>
      </details>}

      <section className="card" aria-labelledby="review-status-heading">
        <div className="section-heading">
          <h2 id="review-status-heading">복습 상태</h2>
          <StatusBadge status={currentReviewState?.learning_status ?? 'unstarted'} />
        </div>
        <div className="status-button-group">
          {REVIEW_STATUSES.map((status) => (
            <button
              key={status}
              className="status-button"
              type="button"
              disabled={savingReview}
              aria-pressed={currentReviewState?.learning_status === status}
              onClick={() => void saveReview(status)}
            >
              {status}
            </button>
          ))}
        </div>
        {reviewError && (
          <p className="field-error" role="alert">
            {reviewError}
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="personal-answer-heading">
        <div className="section-heading">
          <h2 id="personal-answer-heading">나의 답변</h2>
          <div className="badge-row">
            {practiceDraft && <StatusBadge status="has_draft" />}
            {userAnswer && <StatusBadge status="has_answer" />}
          </div>
        </div>
        {practiceDraft && (
          <div className="draft-preview">
            <strong>저장된 연습 초안</strong>
            <p>{practiceDraft.original_input}</p>
          </div>
        )}
        {userAnswer && (
          <LanguageBlock
            label="저장한 교정 완료 답변"
            language={{
              zh: userAnswer.corrected_zh,
              pinyin: userAnswer.corrected_pinyin,
              ko: userAnswer.corrected_ko,
            }}
          />
        )}
        {!practiceDraft && !userAnswer && (
          <EmptyState
            title="아직 저장된 답변이 없습니다"
            description="교정 없이 연습 초안만 저장할 수도 있습니다."
          />
        )}
        <Link
          className="primary-button"
          to={`/questions/${question.question_id}/answer`}
          state={navigationState}
        >
          {userAnswer
            ? '다시 작성'
            : practiceDraft
              ? '답변 이어서 작성'
              : '내 답변 만들기'}
        </Link>
      </section>

      <section className="card" aria-labelledby="model-answer-heading">
        <h2 id="model-answer-heading">모범답안 비교</h2>
        {modelAnswers.length > 0 ? (
          <p>검수된 모범답안이 있습니다.</p>
        ) : (
          <EmptyState
            title="아직 모범답안 없음"
            description="모범답안 없이도 연습 초안 저장과 복습을 계속할 수 있습니다."
          />
        )}
      </section>
    </div>
  )
}
