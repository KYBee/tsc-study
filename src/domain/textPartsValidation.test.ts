import { describe, expect, it } from 'vitest'

import answerPoints from '../../data/working/app-fixtures/text-parts-v1/answer-points.json'
import courseInsights from '../../data/working/app-fixtures/text-parts-v1/course-insights.json'
import learningExpressions from '../../data/working/app-fixtures/text-parts-v1/learning-expressions.json'
import manifest from '../../data/working/app-fixtures/text-parts-v1/manifest.json'
import modelAnswers from '../../data/working/app-fixtures/text-parts-v1/model-answers.json'
import partGuides from '../../data/working/app-fixtures/text-parts-v1/part-guides.json'
import practiceDrills from '../../data/working/app-fixtures/text-parts-v1/practice-drills.json'
import questions from '../../data/working/app-fixtures/text-parts-v1/questions.json'
import sourceReferences from '../../data/working/app-fixtures/text-parts-v1/source-references.json'
import sources from '../../data/working/app-fixtures/text-parts-v1/sources.json'
import {
  FixtureValidationError,
  parseTextPartsFixture,
  type TextPartsFixtureInput,
} from './validation'

const makeInput = (): TextPartsFixtureInput =>
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

describe('parseTextPartsFixture', () => {
  it('accepts the exact 193-question non-visual working fixture', () => {
    const fixture = parseTextPartsFixture(makeInput())

    expect(fixture.questions).toHaveLength(193)
    expect(fixture.answerPoints).toHaveLength(193)
    expect(fixture.modelAnswers).toEqual([])
    expect(
      Object.fromEntries(
        [1, 3, 4, 5, 6].map((part) => [
          part,
          fixture.questions.filter((question) => question.part === part).length,
        ]),
      ),
    ).toEqual({ 1: 4, 3: 84, 4: 50, 5: 36, 6: 19 })
  })

  it('rejects visual Part questions even if a manifest count is changed', () => {
    const input = makeInput()
    const fixtureQuestions = input.questions as Array<Record<string, unknown>>
    fixtureQuestions[0].part = 2

    expect(() => parseTextPartsFixture(input)).toThrow(FixtureValidationError)
    expect(() => parseTextPartsFixture(input)).toThrow(/Part|question/)
  })

  it('rejects a missing AnswerPoint reference', () => {
    const input = makeInput()
    input.answerPoints = (
      input.answerPoints as Array<Record<string, unknown>>
    ).slice(1)

    expect(() => parseTextPartsFixture(input)).toThrow(/AnswerPoint|193/)
  })

  it('rejects generated ModelAnswers', () => {
    const input = makeInput()
    input.modelAnswers = [
      {
        answer_id: 'answer-generated',
        answer_target_type: 'question',
        answer_target_id: 'P1-001',
        answer_variant: 'other',
        answer_status: 'draft',
        provenance_kind: 'project_created',
      },
    ]

    expect(() => parseTextPartsFixture(input)).toThrow(/ModelAnswer/)
  })
})
