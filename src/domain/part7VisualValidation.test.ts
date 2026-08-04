import { describe, expect, it } from 'vitest'

import courseInsights from '../../data/working/app-fixtures/part7-visual-v1/course-insights.json'
import learningExpressions from '../../data/working/app-fixtures/part7-visual-v1/learning-expressions.json'
import manifest from '../../data/working/app-fixtures/part7-visual-v1/manifest.json'
import modelAnswers from '../../data/working/app-fixtures/part7-visual-v1/model-answers.json'
import partGuides from '../../data/working/app-fixtures/part7-visual-v1/part-guides.json'
import practiceDrills from '../../data/working/app-fixtures/part7-visual-v1/practice-drills.json'
import questions from '../../data/working/app-fixtures/part7-visual-v1/questions.json'
import candidates from '../../data/working/app-fixtures/part7-visual-v1/question-visual-link-candidates.json'
import sourceReferences from '../../data/working/app-fixtures/part7-visual-v1/source-references.json'
import sources from '../../data/working/app-fixtures/part7-visual-v1/sources.json'
import storyGuides from '../../data/working/app-fixtures/part7-visual-v1/story-guides.json'
import visualAssets from '../../data/working/app-fixtures/part7-visual-v1/visual-assets.json'
import visualSetAssets from '../../data/working/app-fixtures/part7-visual-v1/visual-set-assets.json'
import visualSets from '../../data/working/app-fixtures/part7-visual-v1/visual-sets.json'
import {
  FixtureValidationError,
  parsePart7VisualFixture,
  type Part7VisualFixtureInput,
} from './validation'

const makeInput = (): Part7VisualFixtureInput =>
  structuredClone({
    visualSets,
    visualAssets,
    visualSetAssets,
    storyGuides,
    questions,
    questionVisualLinkCandidates: candidates,
    modelAnswers,
    sources,
    sourceReferences,
    partGuides,
    learningExpressions,
    practiceDrills,
    courseInsights,
    manifest,
  })

describe('parsePart7VisualFixture', () => {
  it('accepts the exact VisualSet-first local working slice', () => {
    const fixture = parsePart7VisualFixture(makeInput())

    expect(fixture.visualSets).toHaveLength(12)
    expect(fixture.visualAssets).toHaveLength(48)
    expect(fixture.visualSetAssets).toHaveLength(48)
    for (const visualSet of fixture.visualSets) {
      expect(
        fixture.visualSetAssets
          .filter((item) => item.visual_set_id === visualSet.visual_set_id)
          .sort((left, right) => left.sequence - right.sequence)
          .map((item) => item.sequence),
      ).toEqual([1, 2, 3, 4])
    }
    expect(fixture.storyGuides).toHaveLength(12)
    expect(fixture.questions).toHaveLength(12)
    expect(fixture.questionVisualLinkCandidates).toHaveLength(12)
    expect(fixture.modelAnswers).toEqual([])
    expect(fixture.manifest.question_visual_set_links.confirmed).toBe(0)
  })

  it('rejects a candidate promoted to a canonical relationship', () => {
    const input = makeInput()
    ;(
      input.questionVisualLinkCandidates as Array<Record<string, unknown>>
    )[0].canonical_status = 'canonical'

    expect(() => parsePart7VisualFixture(input)).toThrow(FixtureValidationError)
    expect(() => parsePart7VisualFixture(input)).toThrow(/canonical|candidate/i)
  })

  it('rejects a StoryGuide that claims a Question relationship', () => {
    const input = makeInput()
    ;(input.storyGuides as Array<Record<string, unknown>>)[0].question_id =
      'P7-001'

    expect(() => parsePart7VisualFixture(input)).toThrow(/StoryGuide|Question/)
  })

  it('rejects a ModelAnswer or public image right', () => {
    const answerInput = makeInput()
    ;(answerInput.modelAnswers as Array<Record<string, unknown>>).push({
      answer_id: 'ma-forbidden',
      answer_target_type: 'question',
      answer_target_id: 'P7-001',
      answer_variant: 'basic',
      answer_status: 'review_needed',
      provenance_kind: 'unverified_source',
    })
    expect(() => parsePart7VisualFixture(answerInput)).toThrow(/ModelAnswer/)

    const rightsInput = makeInput()
    ;(rightsInput.visualAssets as Array<Record<string, unknown>>)[0].rights_status =
      'public_allowed'
    expect(() => parsePart7VisualFixture(rightsInput)).toThrow(/rights|public/i)
  })
})
