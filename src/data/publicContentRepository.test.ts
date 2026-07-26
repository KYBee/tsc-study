import { describe, expect, it } from 'vitest'

import { loadPart4Fixture } from './fixtureLoader'
import { createPublicContentRepository } from './publicContentRepository'

describe('fixture public content repository', () => {
  it('lists all Parts but exposes fixture questions only for Part 4', async () => {
    const repository = createPublicContentRepository(loadPart4Fixture())

    const parts = await repository.listParts()
    const questions = await repository.listQuestionsByPart(4)

    expect(parts.map((part) => part.part)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(parts.filter((part) => part.availability === 'available')).toEqual([
      expect.objectContaining({
        part: 4,
        name: '일상 화제 설명하기',
        available_question_count: 6,
      }),
    ])
    expect(
      parts
        .filter((part) => part.part !== 4)
        .every((part) => part.available_question_count === undefined),
    ).toBe(true)
    expect(questions.map((question) => question.question_id)).toEqual([
      'P4-001',
      'P4-002',
      'P4-003',
      'P4-006',
      'P4-036',
      'P4-039',
    ])
  })

  it('returns undefined for a missing stable ID without treating it as a load failure', async () => {
    const repository = createPublicContentRepository(loadPart4Fixture())

    await expect(repository.getQuestionById('P4-999')).resolves.toBeUndefined()
    await expect(repository.getPart(8)).resolves.toBeUndefined()
  })

  it('queries related content by explicit IDs rather than Chinese text', async () => {
    const repository = createPublicContentRepository(loadPart4Fixture())

    await expect(repository.listAnswerPointsByQuestionId('P4-006')).resolves.toEqual([
      expect.objectContaining({
        answer_point_id: 'ap-P4-006-001',
        question_id: 'P4-006',
      }),
    ])
    await expect(repository.listModelAnswersByQuestionId('P4-006')).resolves.toEqual([])
    await expect(
      repository.listSourceReferencesForTarget('question', 'P4-006'),
    ).resolves.toEqual([
      expect.objectContaining({
        source_reference_id: 'sr-question-P4-006-extracted',
        target_id: 'P4-006',
      }),
    ])
  })
})
