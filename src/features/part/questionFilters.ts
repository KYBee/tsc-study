import type { Question } from '../../domain/entities'
import type {
  StoredPracticeDraft,
  StoredReviewState,
  StoredUserAnswer,
} from '../../data/userDataRepository'

export interface QuestionListItem {
  question: Question
  reviewState?: StoredReviewState
  practiceDraft?: StoredPracticeDraft
  userAnswer?: StoredUserAnswer
}

export type ReviewFilter = 'all' | 'none' | '못 외움' | '헷갈림' | '외움'
export type WritingFilter = 'all' | 'unwritten' | 'draft' | 'approved'
export type SimpleLearningFilter =
  | 'all'
  | 'unwritten'
  | 'completed'
  | '못 외움'
  | '외움'

export interface QuestionFilters {
  query?: string
  questionType?: string
  reviewStatus?: ReviewFilter
  writingStatus?: WritingFilter
}

export function filterQuestionItems(
  items: QuestionListItem[],
  filters: QuestionFilters,
): QuestionListItem[] {
  const query = filters.query?.trim().toLocaleLowerCase() ?? ''
  const questionType = filters.questionType ?? 'all'
  const reviewStatus = filters.reviewStatus ?? 'all'
  const writingStatus = filters.writingStatus ?? 'all'

  return items.filter(({ question, reviewState, practiceDraft, userAnswer }) => {
    const searchable = [
      question.question_id,
      question.question_type ?? '',
      question.question_zh,
      question.question_ko ?? '',
    ]
      .join('\n')
      .toLocaleLowerCase()
    if (query && !searchable.includes(query)) return false
    if (questionType !== 'all' && question.question_type !== questionType) return false
    if (reviewStatus === 'none' && reviewState) return false
    if (
      reviewStatus !== 'all' &&
      reviewStatus !== 'none' &&
      reviewState?.learning_status !== reviewStatus
    ) {
      return false
    }
    if (writingStatus === 'unwritten' && (practiceDraft || userAnswer)) return false
    if (writingStatus === 'draft' && !practiceDraft) return false
    if (writingStatus === 'approved' && !userAnswer) return false
    return true
  })
}

export type Part4QuestionListItem = QuestionListItem
export type Part4QuestionFilters = QuestionFilters
export const filterPart4QuestionItems = filterQuestionItems

export function filterSimpleLearningItems(
  items: QuestionListItem[],
  filter: SimpleLearningFilter,
): QuestionListItem[] {
  if (filter === 'all') return items
  if (filter === 'unwritten') {
    return items.filter(({ practiceDraft, userAnswer }) => !practiceDraft && !userAnswer)
  }
  if (filter === 'completed') {
    return items.filter(
      ({ practiceDraft, userAnswer }) =>
        practiceDraft?.completion_status === 'completed' || Boolean(userAnswer),
    )
  }
  return items.filter(({ reviewState }) => reviewState?.learning_status === filter)
}

export function pickRandomQuestion<T>(
  items: T[],
  random: () => number = Math.random,
): T | undefined {
  if (items.length === 0) return undefined
  const index = Math.min(items.length - 1, Math.floor(random() * items.length))
  return items[index]
}
