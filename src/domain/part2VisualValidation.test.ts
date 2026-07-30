import { describe, expect, it } from 'vitest'

import courseInsights from '../../data/working/app-fixtures/part2-visual-v1/course-insights.json'
import learningExpressions from '../../data/working/app-fixtures/part2-visual-v1/learning-expressions.json'
import manifest from '../../data/working/app-fixtures/part2-visual-v1/manifest.json'
import modelAnswers from '../../data/working/app-fixtures/part2-visual-v1/model-answers.json'
import partGuides from '../../data/working/app-fixtures/part2-visual-v1/part-guides.json'
import practiceDrills from '../../data/working/app-fixtures/part2-visual-v1/practice-drills.json'
import sourceReferences from '../../data/working/app-fixtures/part2-visual-v1/source-references.json'
import sources from '../../data/working/app-fixtures/part2-visual-v1/sources.json'
import visualAssets from '../../data/working/app-fixtures/part2-visual-v1/visual-assets.json'
import visualQuestions from '../../data/working/app-fixtures/part2-visual-v1/visual-questions.json'
import visualSetAssets from '../../data/working/app-fixtures/part2-visual-v1/visual-set-assets.json'
import visualSets from '../../data/working/app-fixtures/part2-visual-v1/visual-sets.json'
import {
  FixtureValidationError,
  parsePart2VisualFixture,
  type Part2VisualFixtureInput,
} from './validation'

const makeInput = (): Part2VisualFixtureInput =>
  structuredClone({
    visualSets,
    visualAssets,
    visualSetAssets,
    visualQuestions,
    modelAnswers,
    sources,
    sourceReferences,
    partGuides,
    learningExpressions,
    practiceDrills,
    courseInsights,
    manifest,
  })

describe('parsePart2VisualFixture', () => {
  it('accepts the exact local working slice', () => {
    const fixture = parsePart2VisualFixture(makeInput())

    expect(fixture.visualSets).toHaveLength(12)
    expect(fixture.visualAssets).toHaveLength(12)
    expect(fixture.visualSetAssets).toHaveLength(12)
    expect(fixture.visualQuestions).toHaveLength(48)
    expect(fixture.modelAnswers).toHaveLength(48)
    expect(fixture.visualQuestions.filter((item) => item.question_id)).toHaveLength(18)
  })

  it('rejects a public-allowed asset', () => {
    const input = makeInput()
    ;(input.visualAssets as Array<Record<string, unknown>>)[0].rights_status =
      'public_allowed'

    expect(() => parsePart2VisualFixture(input)).toThrow(FixtureValidationError)
    expect(() => parsePart2VisualFixture(input)).toThrow(/rights|public/i)
  })

  it('rejects an unsafe or unregistered asset path', () => {
    const input = makeInput()
    ;(input.visualAssets as Array<Record<string, unknown>>)[0].repository_path =
      '../../secret.png'

    expect(() => parsePart2VisualFixture(input)).toThrow(/path|asset/i)
  })

  it('rejects a ModelAnswer that does not target a fixture VisualQuestion', () => {
    const input = makeInput()
    ;(input.modelAnswers as Array<Record<string, unknown>>)[0].answer_target_id =
      'vq-P2-UNKNOWN-Q1'

    expect(() => parsePart2VisualFixture(input)).toThrow(/ModelAnswer|target/)
  })
})
