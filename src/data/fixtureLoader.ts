import answerPoints from '../../data/working/app-fixtures/part4/answer-points.json'
import manifest from '../../data/working/app-fixtures/part4/manifest.json'
import modelAnswers from '../../data/working/app-fixtures/part4/model-answers.json'
import questions from '../../data/working/app-fixtures/part4/questions.json'
import sourceReferences from '../../data/working/app-fixtures/part4/source-references.json'
import sources from '../../data/working/app-fixtures/part4/sources.json'
import fullAnswerPoints from '../../data/working/app-fixtures/part4-full/answer-points.json'
import fullCourseInsights from '../../data/working/app-fixtures/part4-full/course-insights.json'
import fullLearningExpressions from '../../data/working/app-fixtures/part4-full/learning-expressions.json'
import fullManifest from '../../data/working/app-fixtures/part4-full/manifest.json'
import fullModelAnswers from '../../data/working/app-fixtures/part4-full/model-answers.json'
import fullPartGuides from '../../data/working/app-fixtures/part4-full/part-guides.json'
import fullPracticeDrills from '../../data/working/app-fixtures/part4-full/practice-drills.json'
import fullQuestions from '../../data/working/app-fixtures/part4-full/questions.json'
import fullSourceReferences from '../../data/working/app-fixtures/part4-full/source-references.json'
import fullSources from '../../data/working/app-fixtures/part4-full/sources.json'
import {
  parsePart4Fixture,
  parsePart4FullFixture,
  type Part4Fixture,
  type Part4FullFixture,
} from '../domain/validation'

export const PART4_LEGACY_FIXTURE_DATASET_ID = manifest.dataset_id
export const PART4_FIXTURE_DATASET_ID = fullManifest.dataset_id

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

let cachedFullFixture: Part4FullFixture | undefined

export const loadPart4FullFixture = (): Part4FullFixture => {
  cachedFullFixture ??= parsePart4FullFixture({
    questions: fullQuestions,
    answerPoints: fullAnswerPoints,
    sources: fullSources,
    sourceReferences: fullSourceReferences,
    modelAnswers: fullModelAnswers,
    partGuides: fullPartGuides,
    learningExpressions: fullLearningExpressions,
    practiceDrills: fullPracticeDrills,
    courseInsights: fullCourseInsights,
    manifest: fullManifest,
  })

  return cachedFullFixture
}
