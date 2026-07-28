import { describe, expect, it } from 'vitest'

import answerPoints from '../../data/working/app-fixtures/part4-full/answer-points.json'
import courseInsights from '../../data/working/app-fixtures/part4-full/course-insights.json'
import learningExpressions from '../../data/working/app-fixtures/part4-full/learning-expressions.json'
import manifest from '../../data/working/app-fixtures/part4-full/manifest.json'
import modelAnswers from '../../data/working/app-fixtures/part4-full/model-answers.json'
import partGuides from '../../data/working/app-fixtures/part4-full/part-guides.json'
import practiceDrills from '../../data/working/app-fixtures/part4-full/practice-drills.json'
import questions from '../../data/working/app-fixtures/part4-full/questions.json'
import sourceReferences from '../../data/working/app-fixtures/part4-full/source-references.json'
import sources from '../../data/working/app-fixtures/part4-full/sources.json'
import {
  FixtureValidationError,
  parsePart4FullFixture,
  type Part4FullFixtureInput,
} from './validation'

const makeInput = (): Part4FullFixtureInput =>
  structuredClone({
    questions,
    answerPoints,
    sources,
    sourceReferences,
    modelAnswers,
    partGuides,
    learningExpressions,
    practiceDrills,
    courseInsights,
    manifest,
  })

describe('parsePart4FullFixture', () => {
  it('accepts all fifty raw Part 4 questions and common working material', () => {
    const fixture = parsePart4FullFixture(makeInput())

    expect(fixture.questions).toHaveLength(50)
    expect(fixture.answerPoints).toHaveLength(50)
    expect(fixture.partGuides).toHaveLength(2)
    expect(fixture.learningExpressions).toHaveLength(13)
    expect(fixture.practiceDrills).toHaveLength(2)
    expect(fixture.courseInsights).toHaveLength(6)
    expect(fixture.modelAnswers).toEqual([])
    expect(fixture.manifest.dataset_id).toBe(
      'part4-full-working-development-fixture-v2',
    )
  })

  it('rejects a missing canonical question even when counts are changed', () => {
    const input = makeInput()
    input.questions = (input.questions as Array<Record<string, unknown>>).slice(0, -1)
    const fixtureManifest = input.manifest as {
      counts: Record<string, number>
      ids: Record<string, string[]>
    }
    fixtureManifest.counts.question = 49
    fixtureManifest.ids.question = fixtureManifest.ids.question.slice(0, -1)

    expect(() => parsePart4FullFixture(input)).toThrow(FixtureValidationError)
    expect(() => parsePart4FullFixture(input)).toThrow(/P4-001.*P4-050|50/)
  })

  it('rejects course material that loses its level 3 context', () => {
    const input = makeInput()
    const guides = input.partGuides as Array<Record<string, unknown>>
    const courseGuide = guides.find(
      (guide) => guide.part_guide_id === 'part-guide-04',
    )
    if (!courseGuide) throw new Error('course guide fixture missing')
    courseGuide.course_target_context = 'level_8'

    expect(() => parsePart4FullFixture(input)).toThrow(/level_3|course_target_context/)
  })

  it('rejects an unknown source-reference target instead of dropping it', () => {
    const input = makeInput()
    const references = input.sourceReferences as Array<Record<string, unknown>>
    references[0].target_id = 'missing-target'

    expect(() => parsePart4FullFixture(input)).toThrow(/SourceReference|target/)
  })
})
