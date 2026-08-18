import { Link } from 'react-router-dom'

import { useAppDependencies } from '../../app/dependencies'
import {
  loadLastLearningLocation,
  loadLastStoryLearningLocation,
  loadLastVisualLearningLocation,
} from '../../app/lastLearningLocation'
import { useAsyncData } from '../../app/useAsyncData'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { REVIEW_VISUAL_ASSETS_ENABLED } from '../../data/localVisualAssetUrl'
import type { PartNumber } from '../../domain/entities'

const TEXT_PARTS: PartNumber[] = [1, 3, 4, 5, 6]

export function HomeScreen() {
  const { publicRepository, userRepository } = useAppDependencies()
  const { data, error, loading } = useAsyncData(async () => {
    const [parts, questionGroups, visualSets, storySets, reviewStates, answers, drafts] =
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
      ])
    const visualQuestions = (
      await Promise.all(
        visualSets.map((visualSet) =>
          publicRepository.listVisualQuestionsBySetId(visualSet.visual_set_id),
        ),
      )
    ).flat()

    return {
      parts,
      questions: questionGroups.flat(),
      visualSets,
      storySets,
      visualQuestions,
      reviewStates,
      answers,
      drafts,
      lastLocation: loadLastLearningLocation(
        questionGroups.flat().map((question) => question.question_id),
      ),
      lastVisualLocation: loadLastVisualLearningLocation(
        visualSets.map((visualSet) => visualSet.visual_set_id),
        visualQuestions.map((question) => question.visual_question_id),
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

  const draftTargetIds = new Set(
    data.drafts.map((draft) => draft.target_id ?? draft.question_id),
  )
  const userAnswerQuestionIds = new Set(
    data.answers.map((answer) => answer.question_id),
  )
  const memorizedTargets = new Set(
    data.reviewStates
      .filter((state) => state.learning_status === '외움')
      .map((state) => `${state.target_type}:${state.target_id}`),
  )

  return (
    <div className="page">
      <header className="hero hero--compact">
        <p className="eyebrow">TSC STUDY</p>
        <h1>TSC 공부</h1>
        <p>Part를 선택하고 문제마다 내 답변을 저장해 보세요.</p>
      </header>

      <section aria-labelledby="part-list-heading">
        <div className="section-heading">
          <h2 id="part-list-heading">Part 1~7</h2>
        </div>
        <ul className="card-list home-part-list" aria-label="Part 목록">
          {data.parts.map((part) => {
            if (part.part === 2) {
              const questionIds = new Set(
                data.visualQuestions.map((question) => question.visual_question_id),
              )
              const answered = [...questionIds].filter((questionId) =>
                draftTargetIds.has(questionId),
              ).length
              const memorized = [...questionIds].filter((questionId) =>
                memorizedTargets.has(`visual_question:${questionId}`),
              ).length

              return (
                <HomePartCard
                  key={part.part}
                  part={part.part}
                  name={part.name}
                  countLabel={`${data.visualSets.length}세트 · ${questionIds.size}문항`}
                  answered={answered}
                  total={questionIds.size}
                  memorized={memorized}
                  href="/parts/2"
                  available={part.availability === 'available' && REVIEW_VISUAL_ASSETS_ENABLED}
                  continueLabel={
                    data.lastVisualLocation
                      ? `${data.lastVisualLocation.last_visual_question_id} 이어서 보기`
                      : undefined
                  }
                  continueHref={
                    data.lastVisualLocation
                      ? `/visual-questions/${data.lastVisualLocation.last_visual_question_id}`
                      : undefined
                  }
                />
              )
            }

            if (part.part === 7) {
              const setIds = new Set(
                data.storySets.map((visualSet) => visualSet.visual_set_id),
              )
              const answered = [...setIds].filter((setId) => draftTargetIds.has(setId)).length
              const memorized = [...setIds].filter((setId) =>
                memorizedTargets.has(`visual_set:${setId}`),
              ).length

              return (
                <HomePartCard
                  key={part.part}
                  part={part.part}
                  name={part.name}
                  countLabel={`${setIds.size}세트`}
                  answered={answered}
                  total={setIds.size}
                  memorized={memorized}
                  href="/parts/7"
                  available={part.availability === 'available' && REVIEW_VISUAL_ASSETS_ENABLED}
                  continueLabel={
                    data.lastStoryLocation
                      ? `${data.lastStoryLocation.last_visual_set_id} 이어서 보기`
                      : undefined
                  }
                  continueHref={
                    data.lastStoryLocation
                      ? `/parts/7/sets/${data.lastStoryLocation.last_visual_set_id}`
                      : undefined
                  }
                />
              )
            }

            const questionIds = new Set(
              data.questions
                .filter((question) => question.part === part.part)
                .map((question) => question.question_id),
            )
            const answered = [...questionIds].filter(
              (questionId) =>
                draftTargetIds.has(questionId) || userAnswerQuestionIds.has(questionId),
            ).length
            const memorized = [...questionIds].filter((questionId) =>
              memorizedTargets.has(`question:${questionId}`),
            ).length

            return (
              <HomePartCard
                key={part.part}
                part={part.part}
                name={part.name}
                countLabel={`${questionIds.size}문제`}
                answered={answered}
                total={questionIds.size}
                memorized={memorized}
                href={`/parts/${part.part}`}
                available={part.availability === 'available'}
                continueLabel={
                  data.lastLocation?.last_part === part.part
                    ? `${data.lastLocation.last_question_id} 이어서 보기`
                    : undefined
                }
                continueHref={
                  data.lastLocation?.last_part === part.part
                    ? `/questions/${data.lastLocation.last_question_id}`
                    : undefined
                }
              />
            )
          })}
        </ul>
      </section>
    </div>
  )
}

interface HomePartCardProps {
  part: number
  name: string
  countLabel: string
  answered: number
  total: number
  memorized: number
  href: string
  available: boolean
  continueLabel?: string
  continueHref?: string
}

function HomePartCard({
  part,
  name,
  countLabel,
  answered,
  total,
  memorized,
  href,
  available,
  continueLabel,
  continueHref,
}: HomePartCardProps) {
  const content = (
    <>
      <span className="part-card__number">Part {part}</span>
      <span className="part-card__body">
        <strong>{name}</strong>
        <small>{countLabel}</small>
        <small>내 답변 {answered} / {total}</small>
        <small>외움 {memorized}</small>
        {continueLabel && <small>{continueLabel}</small>}
      </span>
      <span className={available ? 'question-card__cta' : 'coming-soon'}>
        {available ? '공부하기' : '그림 학습 비활성'}
      </span>
    </>
  )

  return (
    <li className="part-card">
      {available ? (
        <Link className="part-card__link" to={continueHref ?? href}>{content}</Link>
      ) : (
        <div className="part-card__disabled" aria-disabled="true">{content}</div>
      )}
    </li>
  )
}
