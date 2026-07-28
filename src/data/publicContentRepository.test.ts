import { describe, expect, it } from 'vitest'

import { loadPart4FullFixture, loadTextPartsFixture } from './fixtureLoader'
import { createPublicContentRepository } from './publicContentRepository'

describe('fixture public content repository', () => {
  it('exposes all five text Parts from the new default fixture', async () => {
    const repository = createPublicContentRepository(loadTextPartsFixture())

    const parts = await repository.listParts()
    expect(
      parts
        .filter((part) => part.availability === 'available')
        .map((part) => [part.part, part.available_question_count]),
    ).toEqual([
      [1, 4],
      [3, 84],
      [4, 50],
      [5, 36],
      [6, 19],
    ])
    expect(parts.find((part) => part.part === 2)).toMatchObject({
      availability: 'coming_soon',
    })
    expect(parts.find((part) => part.part === 7)).toMatchObject({
      availability: 'coming_soon',
    })
  })

  it('queries every included Part without leaking visual questions', async () => {
    const repository = createPublicContentRepository(loadTextPartsFixture())

    await expect(repository.listQuestionsByPart(1)).resolves.toHaveLength(4)
    await expect(repository.listQuestionsByPart(3)).resolves.toHaveLength(84)
    await expect(repository.listQuestionsByPart(4)).resolves.toHaveLength(50)
    await expect(repository.listQuestionsByPart(5)).resolves.toHaveLength(36)
    await expect(repository.listQuestionsByPart(6)).resolves.toHaveLength(19)
    await expect(repository.listQuestionsByPart(2)).resolves.toEqual([])
    await expect(repository.listQuestionsByPart(7)).resolves.toEqual([])
  })

  it('lists all Parts but exposes fixture questions only for Part 4', async () => {
    const repository = createPublicContentRepository(loadPart4FullFixture())

    const parts = await repository.listParts()
    const questions = await repository.listQuestionsByPart(4)

    expect(parts.map((part) => part.part)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(parts.filter((part) => part.availability === 'available')).toEqual([
      expect.objectContaining({
        part: 4,
        name: '일상 화제 설명하기',
        available_question_count: 50,
      }),
    ])
    expect(
      parts
        .filter((part) => part.part !== 4)
        .every((part) => part.available_question_count === undefined),
    ).toBe(true)
    expect(questions.map((question) => question.question_id)).toEqual(
      Array.from({ length: 50 }, (_, index) =>
        `P4-${String(index + 1).padStart(3, '0')}`,
      ),
    )
  })

  it('returns undefined for a missing stable ID without treating it as a load failure', async () => {
    const repository = createPublicContentRepository(loadPart4FullFixture())

    await expect(repository.getQuestionById('P4-999')).resolves.toBeUndefined()
    await expect(repository.getPart(8)).resolves.toBeUndefined()
  })

  it('queries related content by explicit IDs rather than Chinese text', async () => {
    const repository = createPublicContentRepository(loadPart4FullFixture())

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

  it('keeps workbook and level 3 course guidance separate', async () => {
    const repository = createPublicContentRepository(loadPart4FullFixture())

    await expect(repository.listPartGuides(4)).resolves.toEqual([
      expect.objectContaining({
        part_guide_id: 'part-guide-04',
        course_target_context: 'level_3',
      }),
      expect.objectContaining({
        part_guide_id: 'part-guide-workbook-04',
        course_target_context: 'not_specified',
      }),
    ])
    await expect(repository.listLearningExpressionsByPart(4)).resolves.toHaveLength(13)
    await expect(repository.listPracticeDrillsByPart(4)).resolves.toHaveLength(2)
    await expect(repository.listCourseInsightsByPart(4)).resolves.toHaveLength(6)
  })
})
