import { describe, expect, it } from 'vitest'

import type { Part4ReviewDecision } from './entities'
import {
  calculateReviewOverallStatus,
  createEmptyFieldDecisions,
  isReviewDecisionStale,
  PART4_REVIEW_FIELDS,
  part4ReviewDecisionSchema,
  type Part4ReviewItem,
} from './dataReview'

const decision = (): Part4ReviewDecision => ({
  review_decision_id: 'p4-review-decision-P4-001',
  dataset_id: 'part4-review-fixture-v1',
  question_id: 'P4-001',
  field_decisions: Object.fromEntries(
    PART4_REVIEW_FIELDS.map((field) => [field, 'approved']),
  ) as Part4ReviewDecision['field_decisions'],
  overall_status: 'approved',
  reviewer_note: '',
  reviewed_by: '검수자',
  reviewed_at: '2026-07-28T03:00:00.000Z',
  source_question_hash: 'a'.repeat(64),
  source_answer_point_hash: 'b'.repeat(64),
  decision_version: 1,
})

describe('Part4ReviewDecision contract', () => {
  it('requires every field approval for an approved decision', () => {
    const value = decision()
    value.field_decisions.pinyin = 'not_checked'
    expect(() => part4ReviewDecisionSchema.parse(value)).toThrow(/모든 필드/)
  })

  it('requires a note when a field needs fixing', () => {
    const value = decision()
    value.field_decisions.pinyin = 'needs_fix'
    value.overall_status = 'needs_fix'
    expect(() => part4ReviewDecisionSchema.parse(value)).toThrow(/사유/)
  })

  it('calculates approved, needs_fix, and deferred consistently', () => {
    const empty = createEmptyFieldDecisions()
    expect(calculateReviewOverallStatus(empty)).toBe('deferred')
    empty.pinyin = 'needs_fix'
    expect(calculateReviewOverallStatus(empty)).toBe('needs_fix')
    for (const field of PART4_REVIEW_FIELDS) empty[field] = 'approved'
    expect(calculateReviewOverallStatus(empty)).toBe('approved')
  })

  it('marks a decision stale when either source hash changes', () => {
    const value = decision()
    const item = {
      source_question_hash: value.source_question_hash,
      source_answer_point_hash: 'c'.repeat(64),
    } as Part4ReviewItem
    expect(isReviewDecisionStale(value, item)).toBe(true)
  })
})
