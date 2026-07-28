import { describe, expect, it } from 'vitest'

import type { PracticeDraft } from '../../domain/entities'
import {
  createEmptyPart4DraftContent,
  getDraftFullText,
  getDraftLearningStatus,
  joinStructuredAnswer,
  mapRecallResultToReviewStatus,
} from './part4AnswerDraft'

describe('Part 4 structured answer helpers', () => {
  it('joins only learner-authored sections without adding connectors', () => {
    expect(
      joinStructuredAnswer({
        direct_answer: '我喜欢在家运动。',
        reasons: '在家运动很方便。',
        example: '',
        conclusion: '这种方式很适合我。',
      }),
    ).toBe('我喜欢在家运动。\n在家运动很方便。\n这种方式很适合我。')
  })

  it('keeps a legacy free-input draft readable as full text', () => {
    const legacy = {
      practice_draft_id: 'pd-P4-001',
      question_id: 'P4-001',
      input_language: 'ko',
      original_input: '예전 자유 입력 초안',
      draft_status: 'draft',
      created_at: '2026-07-28T00:00:00.000Z',
      updated_at: '2026-07-28T00:00:00.000Z',
    } satisfies PracticeDraft

    expect(getDraftFullText(legacy)).toBe('예전 자유 입력 초안')
    expect(getDraftLearningStatus(legacy)).toBe('writing')
  })

  it('creates empty learner-owned fields and maps explicit recall results', () => {
    expect(createEmptyPart4DraftContent()).toEqual({
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
    })
    expect(mapRecallResultToReviewStatus('could_not_say')).toBe('못 외움')
    expect(mapRecallResultToReviewStatus('used_keywords')).toBe('헷갈림')
    expect(mapRecallResultToReviewStatus('almost')).toBe('헷갈림')
    expect(mapRecallResultToReviewStatus('memorized')).toBe('외움')
  })
})
