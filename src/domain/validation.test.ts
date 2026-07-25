import { describe, expect, it } from 'vitest'

import answerPoints from '../../data/working/app-fixtures/part4/answer-points.json'
import manifest from '../../data/working/app-fixtures/part4/manifest.json'
import modelAnswers from '../../data/working/app-fixtures/part4/model-answers.json'
import questions from '../../data/working/app-fixtures/part4/questions.json'
import sourceReferences from '../../data/working/app-fixtures/part4/source-references.json'
import sources from '../../data/working/app-fixtures/part4/sources.json'
import {
  FixtureValidationError,
  parsePart4Fixture,
  type Part4FixtureInput,
} from './validation'

const makeFixtureInput = (): Part4FixtureInput =>
  structuredClone({
    questions,
    answerPoints,
    sources,
    sourceReferences,
    modelAnswers,
    manifest,
  })

describe('parsePart4Fixture', () => {
  it('accepts the six raw Part 4 questions and an empty ModelAnswer collection', () => {
    const fixture = parsePart4Fixture(makeFixtureInput())

    expect(fixture.questions).toHaveLength(6)
    expect(fixture.questions.every((question) => question.part === 4)).toBe(true)
    expect(fixture.questions.every((question) => question.question_status === 'raw')).toBe(
      true,
    )
    expect(fixture.modelAnswers).toEqual([])
  })

  it('rejects a question without its required stable ID', () => {
    const input = makeFixtureInput()
    const [firstQuestion] = input.questions as Array<Record<string, unknown>>
    delete firstQuestion.question_id

    expect(() => parsePart4Fixture(input)).toThrowError(FixtureValidationError)
    expect(() => parsePart4Fixture(input)).toThrow(/question_id/)
  })

  it('rejects a question with a Part value outside 1 through 7', () => {
    const input = makeFixtureInput()
    const [firstQuestion] = input.questions as Array<Record<string, unknown>>
    firstQuestion.part = 8

    expect(() => parsePart4Fixture(input)).toThrowError(FixtureValidationError)
    expect(() => parsePart4Fixture(input)).toThrow(/part/)
  })

  it('rejects a different dataset ID even when the manifest is otherwise valid', () => {
    const input = makeFixtureInput()
    const fixtureManifest = input.manifest as Record<string, unknown>
    fixtureManifest.dataset_id = 'part4-other-development-fixture-v1'

    expect(() => parsePart4Fixture(input)).toThrow(/dataset_id/)
  })

  it('rejects a consistently reduced payload and matching reduced manifest', () => {
    const input = makeFixtureInput()
    const fixtureQuestions = input.questions as Array<Record<string, unknown>>
    const fixtureAnswerPoints = input.answerPoints as Array<Record<string, unknown>>
    const fixtureSourceReferences = input.sourceReferences as Array<
      Record<string, unknown>
    >
    const fixtureManifest = input.manifest as {
      counts: Record<string, number>
      ids: Record<string, string[]>
    }

    input.questions = fixtureQuestions.filter(
      (question) => question.question_id !== 'P4-039',
    )
    input.answerPoints = fixtureAnswerPoints.filter(
      (answerPoint) => answerPoint.question_id !== 'P4-039',
    )
    input.sourceReferences = fixtureSourceReferences.filter(
      (reference) =>
        reference.target_id !== 'P4-039' &&
        reference.target_id !== 'ap-P4-039-001',
    )
    fixtureManifest.counts.question = 5
    fixtureManifest.counts.answer_point = 5
    fixtureManifest.counts.source_reference = 10
    fixtureManifest.ids.question = fixtureManifest.ids.question.filter(
      (id) => id !== 'P4-039',
    )
    fixtureManifest.ids.answer_point = fixtureManifest.ids.answer_point.filter(
      (id) => id !== 'ap-P4-039-001',
    )
    fixtureManifest.ids.source_reference =
      fixtureManifest.ids.source_reference.filter(
        (id) => !id.includes('P4-039'),
      )

    expect(() => parsePart4Fixture(input)).toThrow(/exactly 6|question IDs/)
  })

  it('rejects reordered Question records even when manifest IDs are reordered to match', () => {
    const input = makeFixtureInput()
    const fixtureQuestions = input.questions as Array<Record<string, unknown>>
    const fixtureManifest = input.manifest as {
      ids: {
        question: string[]
      }
    }
    ;[fixtureQuestions[0], fixtureQuestions[1]] = [
      fixtureQuestions[1],
      fixtureQuestions[0],
    ]
    ;[fixtureManifest.ids.question[0], fixtureManifest.ids.question[1]] = [
      fixtureManifest.ids.question[1],
      fixtureManifest.ids.question[0],
    ]

    expect(() => parsePart4Fixture(input)).toThrow(/question IDs/)
  })

  it('rejects a non-raw Question status within this development fixture', () => {
    const input = makeFixtureInput()
    const [firstQuestion] = input.questions as Array<Record<string, unknown>>
    firstQuestion.question_status = 'normalized'

    expect(() => parsePart4Fixture(input)).toThrow(/question_status/)
  })

  it('rejects an AnswerPoint that is not the one raw unclassified point for its Question', () => {
    const input = makeFixtureInput()
    const [firstAnswerPoint] = input.answerPoints as Array<Record<string, unknown>>
    firstAnswerPoint.point_type = 'key_hint'
    firstAnswerPoint.point_status = 'reviewed'

    expect(() => parsePart4Fixture(input)).toThrow(/AnswerPoint/)
  })

  it('rejects a renamed sole Source even when references and manifest agree', () => {
    const input = makeFixtureInput()
    const [source] = input.sources as Array<Record<string, unknown>>
    const references = input.sourceReferences as Array<Record<string, unknown>>
    const fixtureManifest = input.manifest as {
      ids: {
        source: string[]
      }
    }
    source.source_id = 'src-002'
    for (const reference of references) {
      reference.source_id = 'src-002'
    }
    fixtureManifest.ids.source = ['src-002']

    expect(() => parsePart4Fixture(input)).toThrow(/src-001/)
  })

  it('rejects a SourceReference with a non-extraction or verified relationship', () => {
    const input = makeFixtureInput()
    const [firstReference] = input.sourceReferences as Array<Record<string, unknown>>
    firstReference.relationship_kind = 'claimed_origin'
    firstReference.verification_status = 'verified'

    expect(() => parsePart4Fixture(input)).toThrow(/SourceReference/)
  })

  it('rejects source-reference target cardinality tampering', () => {
    const input = makeFixtureInput()
    const references = input.sourceReferences as Array<Record<string, unknown>>
    const firstQuestionReference = references.find(
      (reference) => reference.source_reference_id === 'sr-question-P4-001-extracted',
    )
    if (firstQuestionReference === undefined) {
      throw new Error('fixture reference missing')
    }
    firstQuestionReference.target_id = 'P4-002'

    expect(() => parsePart4Fixture(input)).toThrow(/cardinality/)
  })
})
