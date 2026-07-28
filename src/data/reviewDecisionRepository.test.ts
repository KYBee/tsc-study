import { afterEach, describe, expect, it } from 'vitest'

import { PART4_REVIEW_FIELDS } from '../domain/dataReview'
import type { Part4ReviewDecision } from '../domain/entities'
import { createReviewDecisionRepository } from './reviewDecisionRepository'
import { DEFAULT_REVIEW_DB_NAME } from './reviewIndexedDb'

const repositories: ReturnType<typeof createReviewDecisionRepository>[] = []

const makeDecision = (note = ''): Part4ReviewDecision => ({
  review_decision_id: 'p4-review-decision-P4-001',
  dataset_id: 'part4-review-fixture-v1',
  question_id: 'P4-001',
  field_decisions: Object.fromEntries(
    PART4_REVIEW_FIELDS.map((field) => [field, 'approved']),
  ) as Part4ReviewDecision['field_decisions'],
  overall_status: 'approved',
  reviewer_note: note,
  reviewed_by: '검수자',
  reviewed_at: '2026-07-28T03:00:00.000Z',
  source_question_hash: 'a'.repeat(64),
  source_answer_point_hash: 'b'.repeat(64),
  decision_version: 1,
})

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.destroy()))
})

describe('review decision repository', () => {
  it('uses a database namespace separate from learning data', () => {
    expect(DEFAULT_REVIEW_DB_NAME).toBe('tsc-study-data-review-v1')
    expect(DEFAULT_REVIEW_DB_NAME).not.toBe('tsc-study-part4-fixture-v1')
  })

  it('upserts one active decision per question and reloads it', async () => {
    const databaseName = `review-test-${crypto.randomUUID()}`
    const first = createReviewDecisionRepository({ databaseName })
    repositories.push(first)
    await first.upsert(makeDecision('처음'))
    await first.upsert(makeDecision('수정'))
    expect(await first.list()).toHaveLength(1)
    expect((await first.getByQuestionId('P4-001'))?.reviewer_note).toBe('수정')
  })

  it('clears decisions only after the caller explicitly invokes clear', async () => {
    const repository = createReviewDecisionRepository({
      databaseName: `review-test-${crypto.randomUUID()}`,
    })
    repositories.push(repository)
    await repository.upsert(makeDecision())
    await repository.clear()
    expect(await repository.list()).toEqual([])
  })
})
