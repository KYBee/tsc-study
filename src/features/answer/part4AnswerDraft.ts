import type {
  Part4PlanningKeywords,
  Part4StructuredAnswer,
  PracticeDraft,
  RecallResult,
  ReviewState,
} from '../../domain/entities'

export function createEmptyPart4DraftContent(): {
  planning_keywords: Part4PlanningKeywords
  structured_answer: Part4StructuredAnswer
} {
  return {
    planning_keywords: {
      direct_answer: [],
      reasons: [],
      example: [],
      conclusion: [],
    },
    structured_answer: {
      direct_answer: '',
      reasons: '',
      example: '',
      conclusion: '',
    },
  }
}

export function joinStructuredAnswer(answer: Part4StructuredAnswer): string {
  return [
    answer.direct_answer,
    answer.reasons,
    answer.example,
    answer.conclusion,
  ]
    .filter((value) => value.trim())
    .join('\n')
}

export function getDraftFullText(draft: PracticeDraft): string {
  return draft.full_text?.trim()
    ? draft.full_text
    : draft.structured_answer
      ? joinStructuredAnswer(draft.structured_answer) || draft.original_input
      : draft.original_input
}

export function getDraftLearningStatus(
  draft: PracticeDraft | undefined,
): 'unstarted' | 'planning' | 'writing' | 'completed' {
  if (!draft) return 'unstarted'
  if (draft.completion_status === 'completed') return 'completed'
  const hasKeywords = Object.values(draft.planning_keywords ?? {}).some(
    (values) => values.length > 0,
  )
  const hasStructuredAnswer = Object.values(draft.structured_answer ?? {}).some(
    (value) => value.trim(),
  )
  if (hasStructuredAnswer || draft.original_input.trim()) return 'writing'
  return hasKeywords ? 'planning' : 'writing'
}

export function mapRecallResultToReviewStatus(
  result: RecallResult,
): ReviewState['learning_status'] {
  if (result === 'could_not_say') return '못 외움'
  if (result === 'memorized') return '외움'
  return '헷갈림'
}
