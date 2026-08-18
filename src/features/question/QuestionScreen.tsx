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
import { LearningStatusButtons } from '../../components/LearningStatusButtons'
import { LoadingState } from '../../components/LoadingState'
import { SimpleAnswerEditor } from '../../components/SimpleAnswerEditor'
import { StatusBadge } from '../../components/StatusBadge'
import type { StoredPracticeDraft } from '../../data/userDataRepository'
import { pickRandomQuestion } from '../part/questionFilters'

const DISPLAY_PREFERENCE_KEY = 'tsc-study:part4:question-language-display'

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
  const [draftOverride, setDraftOverride] = useState<StoredPracticeDraft>()
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
    setDraftOverride(undefined)
  }, [questionId])

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
    partGuides,
    learningExpressions,
    practiceDrills,
    courseInsights,
  } = data
  const currentDraft = draftOverride ?? data.practiceDraft
  const returnTo = getSafeReturnPath(
    location.state,
    `/parts/${question.part}` as
      | '/parts/1'
      | '/parts/3'
      | '/parts/4'
      | '/parts/5'
      | '/parts/6',
  )
  const navigationState = createNavigationContext(returnTo)
  const currentIndex = questions.findIndex(
    (item) => item.question_id === question.question_id,
  )
  const previousQuestion = questions[currentIndex - 1]
  const nextQuestion = questions[currentIndex + 1]
  const courseGuide = partGuides.find(
    (guide) => guide.course_target_context === 'level_3',
  )
  const workbookGuide = partGuides.find((guide) =>
    guide.part_guide_id.startsWith('part-guide-workbook-'),
  )
  const isPart4 = question.part === 4

  const openRandom = () => {
    const selected = pickRandomQuestion(questions)
    if (selected) {
      navigate(`/questions/${selected.question_id}`, {
        state: navigationState,
      })
    }
  }

  return (
    <div className="page simple-question-page">
      <header className="page-header simple-question-header">
        <Link className="back-link" to={returnTo}>
          {returnTo === '/my-answers'
            ? '← 나의 답변'
            : `← Part ${question.part} 문제 목록`}
        </Link>
        <p className="eyebrow">
          PART {question.part} · {question.question_id}
        </p>
        <h1>Part {question.part} 문제</h1>
        {question.question_type && <p>{question.question_type}</p>}
      </header>

      <section className="card primary-question-card">
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
      </section>

      <section className="card primary-learning-action">
        <h2 id="inline-answer-heading">내 답변</h2>
        <SimpleAnswerEditor
          key={question.question_id}
          targetType="question"
          targetId={question.question_id}
          initialDraft={currentDraft}
          fallbackOriginalInput={userAnswer?.original_input}
          fallbackInputLanguage={userAnswer?.input_language}
          userRepository={userRepository}
          onSaved={setDraftOverride}
        />
        <div className="secondary-actions">
          {isPart4 ? (
            <Link
              className="secondary-button"
              to={`/questions/${question.question_id}/answer?step=design`}
              state={navigationState}
            >
              답변 구조 연습하기
            </Link>
          ) : (
            <Link
              className="secondary-button"
              to={`/questions/${question.question_id}/answer`}
              state={navigationState}
            >
              자세히 편집하기
            </Link>
          )}
          {(currentDraft || userAnswer) && (
            <Link
              className="text-link"
              to={`/questions/${question.question_id}/answer?step=complete`}
              state={navigationState}
            >
              답변 다듬기
            </Link>
          )}
          {question.part === 3 && (
            <Link
              className="secondary-button"
              to={`/questions/${question.question_id}/exam`}
            >
              실전 모드
            </Link>
          )}
        </div>
      </section>

      <section className="card primary-learning-action" aria-labelledby="learning-status-heading">
        <h2 id="learning-status-heading">암기 상태</h2>
        <LearningStatusButtons
          key={`review-${question.question_id}`}
          targetType="question"
          targetId={question.question_id}
          initialReviewState={data.reviewState}
          userRepository={userRepository}
        />
      </section>

      <nav className="question-navigation simple-question-navigation" aria-label="문제 이동">
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
        {nextQuestion ? (
          <Link
            className="primary-button"
            to={`/questions/${nextQuestion.question_id}`}
            state={navigationState}
          >
            다음 문제 · {nextQuestion.question_id}
          </Link>
        ) : (
          <Link className="primary-button" to={returnTo}>
            문제 목록
          </Link>
        )}
      </nav>
      <button className="text-button random-question-button" type="button" onClick={openRandom}>
        랜덤 문제 열기
      </button>

      <details className="card guide-details learning-resources">
        <summary><h2>추가 학습 자료 보기</h2></summary>

        <section className="resource-section" aria-label="답변 구성 힌트">
          <h3>문제 원본 힌트</h3>
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
          <section className="resource-section">
            <h3>문제 원본 가이드</h3>
            {workbookGuide.goal && <p>{workbookGuide.goal}</p>}
            {!!workbookGuide.response_structure?.length && (
              <ol className="plain-list">
                {workbookGuide.response_structure.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </section>
        )}

        {courseGuide && (
          <section className="resource-section">
            <h3>강의 기반 기초 구조</h3>
            <p className="source-context">
              3급 과정 맥락 · 검수 전 강의 분석 자료이며 Level 8 공식 가이드가 아닙니다.
            </p>
            <p>{courseGuide.goal}</p>
            <ol className="plain-list">
              {courseGuide.response_structure?.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        )}

        {learningExpressions.length > 0 && (
          <section className="resource-section">
            <h3>재사용 표현</h3>
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
          </section>
        )}

        {practiceDrills.length > 0 && (
          <section className="resource-section">
            <h3>실전 연습</h3>
            <ul className="plain-list">
              {practiceDrills.map((drill) => (
                <li key={drill.drill_id}>{drill.prompt_or_task}</li>
              ))}
            </ul>
          </section>
        )}

        {courseInsights.length > 0 && (
          <section className="resource-section">
            <h3>주의할 실수</h3>
            <ul className="plain-list">
              {courseInsights.map((insight) => (
                <li key={insight.insight_id}>{insight.content_ko}</li>
              ))}
            </ul>
          </section>
        )}

        {userAnswer && (
          <section className="resource-section">
            <h3>교정 완료 답변</h3>
            <LanguageBlock
              label="저장한 교정 완료 답변"
              language={{
                zh: userAnswer.corrected_zh,
                pinyin: userAnswer.corrected_pinyin,
                ko: userAnswer.corrected_ko,
              }}
            />
          </section>
        )}

        <section className="resource-section">
          <h3>모범답안 비교</h3>
          {modelAnswers.length > 0 ? (
            <p>검수된 모범답안이 있습니다.</p>
          ) : (
            <EmptyState
              title="아직 모범답안 없음"
              description="모범답안 없이도 내 답변 저장과 복습을 계속할 수 있습니다."
            />
          )}
        </section>

        <section className="resource-section data-information">
          <h3>데이터 정보</h3>
          <div className="badge-row">
            <StatusBadge status="development_fixture" />
            <StatusBadge status="raw" />
            {currentDraft && <StatusBadge status="has_draft" />}
            {userAnswer && <StatusBadge status="has_answer" />}
          </div>
        </section>
      </details>
    </div>
  )
}
