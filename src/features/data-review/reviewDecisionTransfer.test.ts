import { describe, expect, it } from 'vitest'

import {
  PART4_REVIEW_FIELDS,
  type Part4ReviewItem,
} from '../../domain/dataReview'
import type { Part4ReviewDecision } from '../../domain/entities'
import {
  buildReviewDecisionExport,
  previewReviewDecisionImport,
  serializeReviewDecisionExport,
} from './reviewDecisionTransfer'

const item = (questionId = 'P4-001'): Part4ReviewItem =>
  ({
    question_id: questionId,
    source_question_hash: 'a'.repeat(64),
    source_answer_point_hash: 'b'.repeat(64),
  }) as Part4ReviewItem

const decision = (questionId = 'P4-001'): Part4ReviewDecision => ({
  review_decision_id: `p4-review-decision-${questionId}`,
  dataset_id: 'part4-review-fixture-v1',
  question_id: questionId,
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

describe('review decision transfer', () => {
  it('exports a sorted, versioned decision envelope', () => {
    const value = buildReviewDecisionExport(
      [decision('P4-002'), decision('P4-001')],
      '검수자',
      () => '2026-07-28T04:00:00.000Z',
    )
    expect(value.dataset_id).toBe('part4-review-fixture-v1')
    expect(value.decisions.map((entry) => entry.question_id)).toEqual([
      'P4-001',
      'P4-002',
    ])
  })

  it('previews new, overwrite, identical, stale, and unknown decisions', () => {
    const current = decision('P4-002')
    const overwrite = { ...current, reviewer_note: '새 메모' }
    const stale = decision('P4-003')
    stale.source_question_hash = 'c'.repeat(64)
    const unknown = decision('P4-999')
    const exported = buildReviewDecisionExport(
      [decision('P4-001'), overwrite, stale, unknown],
      '검수자',
      () => '2026-07-28T04:00:00.000Z',
    )
    const preview = previewReviewDecisionImport(
      serializeReviewDecisionExport(exported),
      [item('P4-001'), item('P4-002'), item('P4-003')],
      [current],
    )
    expect(preview.newDecisions).toHaveLength(1)
    expect(preview.overwriteDecisions).toHaveLength(1)
    expect(preview.staleDecisions).toHaveLength(1)
    expect(preview.rejectedDecisions).toHaveLength(1)
  })

  it('rejects invalid JSON, enums, duplicate decisions, and bad dates', () => {
    expect(() => previewReviewDecisionImport('{', [item()], [])).toThrow(
      /JSON/,
    )
    const value = buildReviewDecisionExport(
      [decision()],
      '검수자',
      () => '2026-07-28T04:00:00.000Z',
    ) as unknown as Record<string, unknown>
    const cases = [
      { ...value, exported_at: 'not-a-date' },
      {
        ...value,
        decisions: [
          decision(),
          decision(),
        ],
      },
      {
        ...value,
        decisions: [
          { ...decision(), overall_status: 'auto_approved' },
        ],
      },
    ]
    for (const invalid of cases) {
      expect(() =>
        previewReviewDecisionImport(JSON.stringify(invalid), [item()], []),
      ).toThrow()
    }
  })
})
