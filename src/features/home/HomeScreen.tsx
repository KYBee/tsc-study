import { Link, useNavigate } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import {
  loadLastLearningLocation,
  loadLastStoryLearningLocation,
  loadLastVisualLearningLocation,
} from '../../app/lastLearningLocation'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import type { PartNumber } from '../../domain/entities'
import { pickRandomQuestion } from '../part/questionFilters'

const TEXT_PARTS: PartNumber[] = [1, 3, 4, 5, 6]

export function HomeScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const navigate = useNavigate()
  const { data, error, loading } = useAsyncData(async () => {
    const [
      parts,
      questionGroups,
      visualSets,
      storySets,
      reviewStates,
      answers,
      drafts,
      recallAttempts,
    ] =
      await Promise.all([
        publicRepository.listParts(),
        Promise.all(
          TEXT_PARTS.map((part) => publicRepository.listQuestionsByPart(part)),
        ),
        publicRepository.listVisualSetsByPart(2),
        publicRepository.listVisualSetsByPart(7),
        userRepository.listReviewStates(),
        userRepository.listUserAnswers(),
        userRepository.listPracticeDrafts(),
        userRepository.listRecallAttempts(),
      ])
    const questions = questionGroups.flat()
    const visualQuestions = (
      await Promise.all(
        visualSets.map((item) =>
          publicRepository.listVisualQuestionsBySetId(item.visual_set_id),
        ),
      )
    ).flat()
    return {
      parts,
      questions,
      visualSets,
      storySets,
      visualQuestions,
      reviewStates,
      answers,
      drafts,
      recallAttempts,
      lastLocation: loadLastLearningLocation(
        questions.map((question) => question.question_id),
      ),
      lastVisualLocation: loadLastVisualLearningLocation(
        visualSets.map((visualSet) => visualSet.visual_set_id),
        visualQuestions.map((visualQuestion) => visualQuestion.visual_question_id),
      ),
      lastStoryLocation: loadLastStoryLearningLocation(
        storySets.map((visualSet) => visualSet.visual_set_id),
      ),
    }
  }, [publicRepository, userRepository])

  if (loading) return <LoadingState message="학습 홈을 불러오는 중입니다" />
  if (error || !data) {
    return (
      <ErrorState
        title="학습 홈을 불러오지 못했습니다"
        message="잠시 후 다시 시도해 주세요."
      />
    )
  }

  const questionIds = new Set(data.questions.map((question) => question.question_id))
  const textDrafts = data.drafts.filter(
    (draft) =>
      (draft.target_type ?? 'question') === 'question' &&
      questionIds.has(draft.target_id ?? draft.question_id),
  )
  const textAnswers = data.answers.filter((answer) => questionIds.has(answer.question_id))
  const textReviewStates = data.reviewStates.filter(
    (state) => state.target_type === 'question' && questionIds.has(state.target_id),
  )
  const reviewCounts = {
    none: data.questions.length - textReviewStates.length,
    '못 외움': textReviewStates.filter(
      (state) => state.learning_status === '못 외움',
    ).length,
    헷갈림: textReviewStates.filter(
      (state) => state.learning_status === '헷갈림',
    ).length,
    외움: textReviewStates.filter((state) => state.learning_status === '외움')
      .length,
  }

  const startRandom = () => {
    const selected = pickRandomQuestion(data.questions)
    if (selected) navigate(`/questions/${selected.question_id}`)
  }
  const firstInProgress = textDrafts.find(
    (draft) => draft.completion_status !== 'completed',
  )
  const firstCompleted = textDrafts.find(
    (draft) => draft.completion_status === 'completed',
  )
  const firstConfused = textReviewStates.find(
    (state) => state.learning_status === '헷갈림',
  )
  const completedDraftCount = textDrafts.filter(
    (draft) => draft.completion_status === 'completed',
  ).length
  const visualQuestionIds = new Set(
    data.visualQuestions.map((question) => question.visual_question_id),
  )
  const visualDrafts = data.drafts.filter(
    (draft) =>
      (draft.target_type ?? 'question') === 'visual_question' &&
      visualQuestionIds.has(draft.target_id ?? draft.question_id),
  )
  const visualReviews = data.reviewStates.filter(
    (state) =>
      state.target_type === 'visual_question' &&
      visualQuestionIds.has(state.target_id),
  )
  const storySetIds = new Set(
    data.storySets.map((visualSet) => visualSet.visual_set_id),
  )
  const storyDrafts = data.drafts.filter(
    (draft) =>
      draft.target_type === 'visual_set' &&
      storySetIds.has(draft.target_id ?? draft.question_id),
  )
  const storyReviews = data.reviewStates.filter(
    (state) =>
      state.target_type === 'visual_set' && storySetIds.has(state.target_id),
  )

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">TSC STUDY</p>
        <h1>텍스트와 그림 문제를 내 답변으로 연습하세요</h1>
        <p>Part 1~7 검수 전 자료이며, 입력한 답변만 개인 저장합니다.</p>
      </header>

      <section className="card" aria-labelledby="progress-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR DATA</p>
            <h2 id="progress-heading">텍스트 파트 학습 현황</h2>
          </div>
          <Link className="text-link" to="/review">
            복습 열기
          </Link>
        </div>
        <dl className="stats-grid">
          <div><dt>전체 문제</dt><dd>{data.questions.length}</dd></div>
          <div><dt>작성 시작</dt><dd>{textDrafts.length}</dd></div>
          <div><dt>작성 완료</dt><dd>{completedDraftCount}</dd></div>
          <div><dt>교정 완료</dt><dd>{textAnswers.length}</dd></div>
          <div><dt>상태 없음</dt><dd>{reviewCounts.none}</dd></div>
          <div><dt>못 외움</dt><dd>{reviewCounts['못 외움']}</dd></div>
          <div><dt>헷갈림</dt><dd>{reviewCounts.헷갈림}</dd></div>
          <div><dt>외움</dt><dd>{reviewCounts.외움}</dd></div>
        </dl>
      </section>

      <section className="card" aria-labelledby="learning-actions-heading">
        <h2 id="learning-actions-heading">무엇을 연습할까요?</h2>
        <div className="home-action-grid">
          <Link className="primary-button" to="/parts/1">
            새 문제로 답변 만들기
          </Link>
          {firstInProgress && (
            <Link
              className="secondary-button"
              to={`/questions/${firstInProgress.question_id}/answer?step=write`}
            >
              작성 중인 답변 이어서
            </Link>
          )}
          {firstCompleted && (
            <Link
              className="secondary-button"
              to={`/questions/${firstCompleted.question_id}/answer?step=recall&mode=question_only`}
            >
              질문만 보고 말하기
            </Link>
          )}
          {firstConfused && (
            <Link
              className="secondary-button"
              to={`/questions/${firstConfused.target_id}/answer?step=recall`}
            >
              헷갈리는 문제 복습
            </Link>
          )}
        </div>
        {data.recallAttempts.length > 0 && (
          <p className="field-help">저장된 회상 기록 {data.recallAttempts.length}회</p>
        )}
      </section>

      <section className="card" aria-labelledby="continue-heading">
        <p className="eyebrow">CONTINUE</p>
        <h2 id="continue-heading">이어서 학습</h2>
        {data.lastLocation ? (
          <Link
            className="primary-button"
            to={`/questions/${data.lastLocation.last_question_id}`}
          >
            {data.lastLocation.last_question_id} 이어서 보기
          </Link>
        ) : (
          <p>아직 저장된 마지막 학습 위치가 없습니다.</p>
        )}
        <button className="secondary-button" type="button" onClick={startRandom}>
          랜덤 문제 시작
        </button>
      </section>

      {textReviewStates.length === 0 && (
        <EmptyState
          title="아직 복습 상태가 없습니다"
          description="문제에서 상태를 직접 선택하면 이곳의 현황에 반영됩니다."
        />
      )}

      <section aria-labelledby="part-list-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LEARN</p>
            <h2 id="part-list-heading">Part 1~7</h2>
          </div>
        </div>
        <ul className="card-list" aria-label="Part 목록">
          {data.parts.map((part) => {
            if (part.part === 2) {
              const completed = visualDrafts.filter(
                (draft) => draft.completion_status === 'completed',
              ).length
              return (
                <li key={part.part} className="part-card">
                  {part.availability === 'available' && import.meta.env.DEV ? (
                    <Link className="part-card__link" to="/parts/2">
                      <span className="part-card__number">Part 2</span>
                      <span className="part-card__body">
                        <strong>{part.name}</strong>
                        <small>
                          {part.available_visual_set_count}세트 ·{' '}
                          {part.available_visual_question_count}문항 · 작성{' '}
                          {visualDrafts.length} · 완료 {completed}
                        </small>
                        <small>
                          헷갈림{' '}
                          {visualReviews.filter((item) => item.learning_status === '헷갈림').length}
                          {' · '}외움{' '}
                          {visualReviews.filter((item) => item.learning_status === '외움').length}
                        </small>
                        {data.lastVisualLocation && (
                          <small>
                            마지막 세트{' '}
                            {Number(
                              data.lastVisualLocation.last_visual_set_id.match(/V(\d+)$/)?.[1] ?? 0,
                            )}
                            {' · 질문 '}
                            {Number(
                              data.lastVisualLocation.last_visual_question_id.match(/Q(\d+)$/)?.[1] ?? 0,
                            )}
                          </small>
                        )}
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ) : (
                    <div className="part-card__disabled" aria-disabled="true">
                      <span className="part-card__number">Part 2</span>
                      <span className="part-card__body">
                        <strong>{part.name}</strong>
                        <small>로컬 그림 학습 전용</small>
                      </span>
                      <span className="coming-soon">권리 검수 중</span>
                    </div>
                  )}
                </li>
              )
            }
            if (part.part === 7) {
              const completed = storyDrafts.filter(
                (draft) => draft.completion_status === 'completed',
              ).length
              return (
                <li key={part.part} className="part-card">
                  {part.availability === 'available' && import.meta.env.DEV ? (
                    <Link className="part-card__link" to="/parts/7">
                      <span className="part-card__number">Part 7</span>
                      <span className="part-card__body">
                        <strong>{part.name}</strong>
                        <small>
                          {part.available_visual_set_count}세트 · 작성{' '}
                          {storyDrafts.length} · 완료 {completed}
                        </small>
                        <small>
                          헷갈림{' '}
                          {storyReviews.filter((item) => item.learning_status === '헷갈림').length}
                          {' · '}외움{' '}
                          {storyReviews.filter((item) => item.learning_status === '외움').length}
                        </small>
                        {data.lastStoryLocation && (
                          <small>
                            마지막 세트{' '}
                            {Number(
                              data.lastStoryLocation.last_visual_set_id.match(/V(\d+)$/)?.[1] ?? 0,
                            )}
                          </small>
                        )}
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ) : (
                    <div className="part-card__disabled" aria-disabled="true">
                      <span className="part-card__number">Part 7</span>
                      <span className="part-card__body">
                        <strong>{part.name}</strong>
                        <small>로컬 그림 학습 전용</small>
                      </span>
                      <span className="coming-soon">권리 검수 중</span>
                    </div>
                  )}
                </li>
              )
            }
            const partQuestionIds = new Set(
              data.questions
                .filter((question) => question.part === part.part)
                .map((question) => question.question_id),
            )
            const partDrafts = textDrafts.filter((draft) =>
              partQuestionIds.has(draft.question_id),
            )
            const partReviews = textReviewStates.filter((state) =>
              partQuestionIds.has(state.target_id),
            )
            const completed = partDrafts.filter(
              (draft) => draft.completion_status === 'completed',
            ).length
            const confused = partReviews.filter(
              (state) => state.learning_status === '헷갈림',
            ).length
            const memorized = partReviews.filter(
              (state) => state.learning_status === '외움',
            ).length
            return (
              <li key={part.part} className="part-card">
                {part.availability === 'available' ? (
                  <Link className="part-card__link" to={`/parts/${part.part}`}>
                    <span className="part-card__number">Part {part.part}</span>
                    <span className="part-card__body">
                      <strong>{part.name}</strong>
                      <small>
                        {part.available_question_count}개 · 작성 {partDrafts.length} ·
                        완료 {completed} · 헷갈림 {confused} · 외움 {memorized}
                      </small>
                      {data.lastLocation?.last_part === part.part && (
                        <small>마지막 {data.lastLocation.last_question_id}</small>
                      )}
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <div className="part-card__disabled" aria-disabled="true">
                    <span className="part-card__number">Part {part.part}</span>
                    <span className="part-card__body">
                      <strong>{part.name}</strong>
                      <small>그림 문제 준비 중</small>
                    </span>
                    <span className="coming-soon">준비 중</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
