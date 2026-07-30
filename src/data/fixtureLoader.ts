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
import textAnswerPoints from '../../data/working/app-fixtures/text-parts-v1/answer-points.json'
import textCourseInsights from '../../data/working/app-fixtures/text-parts-v1/course-insights.json'
import textLearningExpressions from '../../data/working/app-fixtures/text-parts-v1/learning-expressions.json'
import textManifest from '../../data/working/app-fixtures/text-parts-v1/manifest.json'
import textModelAnswers from '../../data/working/app-fixtures/text-parts-v1/model-answers.json'
import textPartGuides from '../../data/working/app-fixtures/text-parts-v1/part-guides.json'
import textPracticeDrills from '../../data/working/app-fixtures/text-parts-v1/practice-drills.json'
import textQuestions from '../../data/working/app-fixtures/text-parts-v1/questions.json'
import textSourceReferences from '../../data/working/app-fixtures/text-parts-v1/source-references.json'
import textSources from '../../data/working/app-fixtures/text-parts-v1/sources.json'
import part2CourseInsights from '../../data/working/app-fixtures/part2-visual-v1/course-insights.json'
import part2LearningExpressions from '../../data/working/app-fixtures/part2-visual-v1/learning-expressions.json'
import part2Manifest from '../../data/working/app-fixtures/part2-visual-v1/manifest.json'
import part2ModelAnswers from '../../data/working/app-fixtures/part2-visual-v1/model-answers.json'
import part2PartGuides from '../../data/working/app-fixtures/part2-visual-v1/part-guides.json'
import part2PracticeDrills from '../../data/working/app-fixtures/part2-visual-v1/practice-drills.json'
import part2SourceReferences from '../../data/working/app-fixtures/part2-visual-v1/source-references.json'
import part2Sources from '../../data/working/app-fixtures/part2-visual-v1/sources.json'
import part2VisualAssets from '../../data/working/app-fixtures/part2-visual-v1/visual-assets.json'
import part2VisualQuestions from '../../data/working/app-fixtures/part2-visual-v1/visual-questions.json'
import part2VisualSetAssets from '../../data/working/app-fixtures/part2-visual-v1/visual-set-assets.json'
import part2VisualSets from '../../data/working/app-fixtures/part2-visual-v1/visual-sets.json'
import {
  parsePart2VisualFixture,
  parsePart4Fixture,
  parsePart4FullFixture,
  parseTextPartsFixture,
  type Part2VisualFixture,
  type Part4Fixture,
  type Part4FullFixture,
  type TextPartsFixture,
} from '../domain/validation'

export const PART4_LEGACY_FIXTURE_DATASET_ID = manifest.dataset_id
export const PART4_FIXTURE_DATASET_ID = fullManifest.dataset_id
export const TEXT_PARTS_FIXTURE_DATASET_ID = textManifest.dataset_id
export const PART2_VISUAL_FIXTURE_DATASET_ID = part2Manifest.dataset_id

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

let cachedTextPartsFixture: TextPartsFixture | undefined

export const loadTextPartsFixture = (): TextPartsFixture => {
  cachedTextPartsFixture ??= parseTextPartsFixture({
    questions: textQuestions,
    answerPoints: textAnswerPoints,
    sources: textSources,
    sourceReferences: textSourceReferences,
    modelAnswers: textModelAnswers,
    partGuides: textPartGuides,
    learningExpressions: textLearningExpressions,
    practiceDrills: textPracticeDrills,
    courseInsights: textCourseInsights,
    manifest: textManifest,
  })

  return cachedTextPartsFixture
}

let cachedPart2VisualFixture: Part2VisualFixture | undefined

export const loadPart2VisualFixture = (): Part2VisualFixture => {
  cachedPart2VisualFixture ??= parsePart2VisualFixture({
    visualSets: part2VisualSets,
    visualAssets: part2VisualAssets,
    visualSetAssets: part2VisualSetAssets,
    visualQuestions: part2VisualQuestions,
    modelAnswers: part2ModelAnswers,
    sources: part2Sources,
    sourceReferences: part2SourceReferences,
    partGuides: part2PartGuides,
    learningExpressions: part2LearningExpressions,
    practiceDrills: part2PracticeDrills,
    courseInsights: part2CourseInsights,
    manifest: part2Manifest,
  })
  return cachedPart2VisualFixture
}
