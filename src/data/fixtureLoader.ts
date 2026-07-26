import answerPoints from '../../data/working/app-fixtures/part4/answer-points.json'
import manifest from '../../data/working/app-fixtures/part4/manifest.json'
import modelAnswers from '../../data/working/app-fixtures/part4/model-answers.json'
import questions from '../../data/working/app-fixtures/part4/questions.json'
import sourceReferences from '../../data/working/app-fixtures/part4/source-references.json'
import sources from '../../data/working/app-fixtures/part4/sources.json'
import { parsePart4Fixture, type Part4Fixture } from '../domain/validation'

export const PART4_FIXTURE_DATASET_ID = manifest.dataset_id

let cachedFixture: Part4Fixture | undefined

export const loadPart4Fixture = (): Part4Fixture => {
  cachedFixture ??= parsePart4Fixture({
    questions,
    answerPoints,
    sources,
    sourceReferences,
    modelAnswers,
    manifest,
  })

  return cachedFixture
}
