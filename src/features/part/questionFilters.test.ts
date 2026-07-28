import { describe, expect, it } from 'vitest'

import type { Question } from '../../domain/entities'
import {
  filterPart4QuestionItems,
  pickRandomQuestion,
  type Part4QuestionListItem,
} from './questionFilters'

const question = (
  question_id: string,
  question_type: string,
  question_zh: string,
  question_ko: string,
): Question => ({
  question_id,
  part: 4,
  question_type,
  question_zh,
  question_pinyin: '',
  question_ko,
  question_status: 'raw',
  normalization_notes: '',
  tags: [],
})

const items: Part4QuestionListItem[] = [
  { question: question('P4-001', '친구', '朋友', '친구') },
  {
    question: question('P4-006', '운동', '你喜欢在哪儿运动？', '어디에서 운동합니까?'),
    practiceDraft: {
      practice_draft_id: 'pd-P4-006',
      question_id: 'P4-006',
      input_language: 'zh',
      original_input: '我喜欢在家运动。',
      draft_status: 'draft',
      created_at: '2026-07-26T00:00:00.000Z',
      updated_at: '2026-07-26T00:00:00.000Z',
    },
    reviewState: {
      review_state_id: 'rs-question-P4-006',
      target_type: 'question',
      target_id: 'P4-006',
      learning_status: '헷갈림',
      review_count: 1,
    },
  },
  {
    question: question('P4-007', '운동', '你一个星期运动几次？', '몇 번 운동합니까?'),
    userAnswer: {
      user_answer_id: 'ua-P4-007',
      question_id: 'P4-007',
      input_language: 'zh',
      original_input: '原文',
      corrected_zh: '答案',
      corrected_pinyin: 'dá àn',
      corrected_ko: '답변',
      correction_mode: 'minimal',
      change_summary: [],
      structure_segments: [],
      save_status: 'user_approved',
      created_at: '2026-07-26T00:00:00.000Z',
      updated_at: '2026-07-26T00:00:00.000Z',
    },
  },
]

describe('Part 4 question filters', () => {
  it('searches IDs, Chinese, Korean, and question type', () => {
    expect(filterPart4QuestionItems(items, { query: 'p4-006' })).toHaveLength(1)
    expect(filterPart4QuestionItems(items, { query: '在哪儿' })).toHaveLength(1)
    expect(filterPart4QuestionItems(items, { query: '몇 번' })).toHaveLength(1)
    expect(filterPart4QuestionItems(items, { query: '친구' })).toHaveLength(1)
  })

  it('combines type, ReviewState, and writing-state filters', () => {
    expect(filterPart4QuestionItems(items, { questionType: '운동' })).toHaveLength(2)
    expect(filterPart4QuestionItems(items, { reviewStatus: '헷갈림' })).toHaveLength(1)
    expect(filterPart4QuestionItems(items, { reviewStatus: 'none' })).toHaveLength(2)
    expect(filterPart4QuestionItems(items, { writingStatus: 'draft' })).toHaveLength(1)
    expect(filterPart4QuestionItems(items, { writingStatus: 'approved' })).toHaveLength(1)
    expect(filterPart4QuestionItems(items, { writingStatus: 'unwritten' })).toHaveLength(1)
  })

  it('selects deterministically when a random source is injected', () => {
    expect(pickRandomQuestion(items, () => 0)?.question.question_id).toBe('P4-001')
    expect(pickRandomQuestion(items, () => 0.99)?.question.question_id).toBe('P4-007')
    expect(pickRandomQuestion([], () => 0.5)).toBeUndefined()
  })
})
