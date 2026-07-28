import type { Question } from '../../domain/entities'
import type {
  StoredPracticeDraft,
  StoredReviewState,
  StoredUserAnswer,
} from '../../data/userDataRepository'

export interface Part4QuestionListItem {
  question: Question
  reviewState?: StoredReviewState
  practiceDraft?: StoredPracticeDraft
  userAnswer?: StoredUserAnswer
}

export type ReviewFilter = 'all' | 'none' | '못 외움' | '헷갈림' | '외움'
export type WritingFilter = 'all' | 'unwritten' | 'draft' | 'approved'

export interface Part4QuestionFilters {
  query?: string
  questionType?: string
  reviewStatus?: ReviewFilter
  writingStatus?: WritingFilter
}

export function filterPart4QuestionItems(
  items: Part4QuestionListItem[],
  filters: Part4QuestionFilters,
): Part4QuestionListItem[] {
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

export function pickRandomQuestion<T>(
  items: T[],
  random: () => number = Math.random,
): T | undefined {
  if (items.length === 0) return undefined
  const index = Math.min(items.length - 1, Math.floor(random() * items.length))
  return items[index]
}
