import { Link, useNavigate } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import { loadLastLearningLocation } from '../../app/lastLearningLocation'
import { useAsyncData } from '../../app/useAsyncData'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { pickRandomQuestion } from '../part/questionFilters'

export function HomeScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const navigate = useNavigate()
  const { data, error, loading } = useAsyncData(async () => {
    const [parts, questions, reviewStates, answers, drafts, recallAttempts] = await Promise.all([
      publicRepository.listParts(),
      publicRepository.listQuestionsByPart(4),
      userRepository.listReviewStates(),
      userRepository.listUserAnswers(),
      userRepository.listPracticeDrafts(),
      userRepository.listRecallAttempts(),
    ])
    const questionReviewStates = reviewStates.filter(
      (state) => state.target_type === 'question',
    )
    return {
      parts,
      questions,
      reviewStates: questionReviewStates,
      answers,
      drafts,
      recallAttempts,
      lastLocation: loadLastLearningLocation(
        questions.map((question) => question.question_id),
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

  const reviewCounts = {
    none: data.questions.length - data.reviewStates.length,
    '못 외움': data.reviewStates.filter(
      (state) => state.learning_status === '못 외움',
    ).length,
    헷갈림: data.reviewStates.filter(
      (state) => state.learning_status === '헷갈림',
    ).length,
    외움: data.reviewStates.filter((state) => state.learning_status === '외움')
      .length,
  }

  const startRandom = () => {
    const selected = pickRandomQuestion(data.questions)
    if (selected) navigate(`/questions/${selected.question_id}`)
  }
  const firstInProgress = data.drafts.find(
    (draft) => draft.completion_status !== 'completed',
  )
  const firstCompleted = data.drafts.find(
    (draft) => draft.completion_status === 'completed',
  )
  const firstConfused = data.reviewStates.find(
    (state) => state.learning_status === '헷갈림',
  )
  const completedDraftCount = data.drafts.filter(
    (draft) => draft.completion_status === 'completed',
  ).length

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">TSC STUDY</p>
        <h1>Part 4의 50문제를 직접 연습해 보세요</h1>
        <p>검수 전 문제이며, 연습 초안은 실제 AI 없이도 저장할 수 있습니다.</p>
      </header>

      <section className="card" aria-labelledby="progress-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR DATA</p>
            <h2 id="progress-heading">Part 4 학습 현황</h2>
          </div>
          <Link className="text-link" to="/review">
            복습 열기
          </Link>
        </div>
        <dl className="stats-grid">
          <div>
            <dt>전체 문제</dt>
            <dd>{data.questions.length}</dd>
          </div>
          <div>
            <dt>작성 시작</dt>
            <dd>{data.drafts.length}</dd>
          </div>
          <div>
            <dt>작성 완료</dt>
            <dd>{completedDraftCount}</dd>
          </div>
          <div>
            <dt>교정 완료</dt>
            <dd>{data.answers.length}</dd>
          </div>
          <div>
            <dt>상태 없음</dt>
            <dd>{reviewCounts.none}</dd>
          </div>
          <div>
            <dt>못 외움</dt>
            <dd>{reviewCounts['못 외움']}</dd>
          </div>
          <div>
            <dt>헷갈림</dt>
            <dd>{reviewCounts.헷갈림}</dd>
          </div>
          <div>
            <dt>외움</dt>
            <dd>{reviewCounts.외움}</dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-labelledby="learning-actions-heading">
        <h2 id="learning-actions-heading">무엇을 연습할까요?</h2>
        <div className="home-action-grid">
          <Link className="primary-button" to="/parts/4">
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
            <>
              <Link
                className="secondary-button"
                to={`/questions/${firstCompleted.question_id}/answer?step=recall&mode=keywords_only`}
              >
                키워드 암기
              </Link>
              <Link
                className="secondary-button"
                to={`/questions/${firstCompleted.question_id}/answer?step=recall&mode=question_only`}
              >
                질문만 보고 말하기
              </Link>
            </>
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
          <>
            <p>아직 저장된 마지막 학습 위치가 없습니다.</p>
            <Link className="primary-button" to="/parts/4">
              Part 4 학습 시작
            </Link>
          </>
        )}
        <button className="secondary-button" type="button" onClick={startRandom}>
          랜덤 문제 시작
        </button>
      </section>

      {data.reviewStates.length === 0 && (
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
          {data.parts.map((part) => (
            <li key={part.part} className="part-card">
              {part.availability === 'available' ? (
                <Link className="part-card__link" to={`/parts/${part.part}`}>
                  <span className="part-card__number">Part {part.part}</span>
                  <span className="part-card__body">
                    <strong>{part.name}</strong>
                    <small>{part.available_question_count}개 검수 전 문제</small>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <div className="part-card__disabled" aria-disabled="true">
                  <span className="part-card__number">Part {part.part}</span>
                  <span className="part-card__body">
                    <strong>{part.name}</strong>
                    <small>아직 학습 콘텐츠가 없습니다</small>
                  </span>
                  <span className="coming-soon">준비 중</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
