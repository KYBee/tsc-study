import { z } from 'zod'

import type {
  AnswerPoint,
  ModelAnswer,
  Question,
  Source,
  SourceReference,
} from './entities'

const identifierSchema = z.string().min(1)
const partSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
])
const optionalTextSchema = z.string().optional()
const PART4_FIXTURE_DATASET_ID = 'part4-raw-development-fixture-v1'
const EXPECTED_QUESTION_IDS = [
  'P4-001',
  'P4-002',
  'P4-003',
  'P4-006',
  'P4-036',
  'P4-039',
] as const

export const questionSchema = z
  .object({
    question_id: identifierSchema,
    part: partSchema,
    question_type: optionalTextSchema,
    question_zh: z.string().min(1),
    question_pinyin: optionalTextSchema,
    question_ko: optionalTextSchema,
    question_status: z.enum(['raw', 'normalized', 'verified']),
    normalization_notes: optionalTextSchema,
    tags: z.array(z.string()).optional(),
  })
  .strict()

export const answerPointSchema = z
  .object({
    answer_point_id: identifierSchema,
    question_id: identifierSchema,
    point_type: z.enum([
      'response_structure',
      'key_hint',
      'time_guidance',
      'evaluation_focus',
      'source_note',
      'story_point',
      'unclassified',
      'other',
    ]),
    content: z.string().min(1),
    sequence: z.number().int().positive().optional(),
    point_status: z.enum(['raw', 'review_needed', 'reviewed']),
    source_reference_ids: z.array(identifierSchema).optional(),
    notes: optionalTextSchema,
  })
  .strict()

export const sourceSchema = z
  .object({
    source_id: identifierSchema,
    title: z.string().min(1),
    source_type: z.enum([
      'course_analysis',
      'excel',
      'pdf',
      'instructor_correction',
      'self_created',
      'other',
    ]),
    provenance_status: z.enum(['verified_source', 'unverified_source', 'self_created']),
    creator_or_provider: optionalTextSchema,
    original_file_name: optionalTextSchema,
    file_ref: optionalTextSchema,
    acquired_date: optionalTextSchema,
    rights_status: z.enum(['review_needed', 'private_use', 'public_allowed', 'restricted']),
    notes: optionalTextSchema,
  })
  .strict()

export const sourceReferenceSchema = z
  .object({
    source_reference_id: identifierSchema,
    target_type: z.enum([
      'question',
      'model_answer',
      'correction',
      'part_guide',
      'visual_set',
      'visual_question',
      'question_visual_set',
      'story_guide',
      'answer_point',
    ]),
    target_id: identifierSchema,
    source_id: identifierSchema,
    source_locator: optionalTextSchema,
    relationship_kind: z.enum([
      'extracted_from',
      'claimed_origin',
      'derived_from',
      'supports',
      'self_created',
    ]),
    claimed_source_name: optionalTextSchema,
    claimed_source_url: optionalTextSchema,
    source_grade: optionalTextSchema,
    originality: optionalTextSchema,
    verification_status: z.enum(['unverified', 'review_needed', 'verified', 'rejected']),
    notes: optionalTextSchema,
  })
  .strict()

const structureSegmentSchema = z
  .object({
    label: z.string().min(1),
    content: z.string(),
  })
  .strict()

export const modelAnswerSchema = z
  .object({
    answer_id: identifierSchema,
    answer_target_type: z.enum(['question', 'visual_question']),
    answer_target_id: identifierSchema,
    answer_variant: z.enum(['basic', 'level_8_expansion', 'other']),
    target_level: optionalTextSchema,
    answer_zh: optionalTextSchema,
    answer_pinyin: optionalTextSchema,
    answer_ko: optionalTextSchema,
    structure_segments: z.array(structureSegmentSchema).optional(),
    answer_status: z.enum(['missing', 'draft', 'review_needed', 'reviewed', 'approved']),
    provenance_kind: z.enum(['verified_source', 'project_created', 'unverified_source']),
    source_reference_ids: z.array(identifierSchema).optional(),
    review_notes: optionalTextSchema,
  })
  .strict()

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

const manifestSchema = z
  .object({
    dataset_id: z.literal(PART4_FIXTURE_DATASET_ID),
    dataset_status: z.literal('development_fixture'),
    source_file: z
      .object({
        path: z.string().min(1),
        sha256: sha256Schema,
      })
      .strict(),
    model_answer_source_file: z
      .object({
        path: z.string().min(1),
        sha256: sha256Schema,
        record_count: z.number().int().nonnegative(),
      })
      .strict(),
    source_metadata_file: z
      .object({
        path: z.string().min(1),
        sha256: sha256Schema,
      })
      .strict(),
    generated_files: z.record(z.string(), sha256Schema),
    manifest_hash_policy: z.string().min(1),
    counts: z
      .object({
        question: z.number().int().nonnegative(),
        answer_point: z.number().int().nonnegative(),
        source: z.number().int().nonnegative(),
        source_reference: z.number().int().nonnegative(),
        model_answer: z.number().int().nonnegative(),
      })
      .strict(),
    ids: z
      .object({
        question: z.array(identifierSchema),
        answer_point: z.array(identifierSchema),
        source: z.array(identifierSchema),
        source_reference: z.array(identifierSchema),
        model_answer: z.array(identifierSchema),
      })
      .strict(),
  })
  .strict()

const fixtureSchema = z
  .object({
    questions: z.array(questionSchema),
    answerPoints: z.array(answerPointSchema),
    sources: z.array(sourceSchema),
    sourceReferences: z.array(sourceReferenceSchema),
    modelAnswers: z.array(modelAnswerSchema),
    manifest: manifestSchema,
  })
  .strict()

export type Part4FixtureManifest = z.infer<typeof manifestSchema>

export interface Part4FixtureInput {
  questions: unknown
  answerPoints: unknown
  sources: unknown
  sourceReferences: unknown
  modelAnswers: unknown
  manifest: unknown
}

export interface Part4Fixture {
  questions: Question[]
  answerPoints: AnswerPoint[]
  sources: Source[]
  sourceReferences: SourceReference[]
  modelAnswers: ModelAnswer[]
  manifest: Part4FixtureManifest
}

export class FixtureValidationError extends Error {
  constructor(
    message: string,
    options?: {
      cause?: unknown
    },
  ) {
    super(message, options)
    this.name = 'FixtureValidationError'
  }
}

const ensureUniqueIds = (values: string[], label: string) => {
  if (new Set(values).size !== values.length) {
    throw new FixtureValidationError(`${label}: duplicate stable ID`)
  }
}

const ensureExactIds = (actual: string[], expected: string[], label: string) => {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new FixtureValidationError(`${label}: manifest IDs do not match fixture records`)
  }
}

const ensureExpectedValues = (
  actual: readonly string[],
  expected: readonly string[],
  label: string,
) => {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new FixtureValidationError(`${label}: does not match the exact development fixture`)
  }
}

const formatIssues = (error: z.ZodError) =>
  error.issues
    .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : 'fixture'}: ${issue.message}`)
    .join('; ')

export const parsePart4Fixture = (input: Part4FixtureInput): Part4Fixture => {
  const parsed = fixtureSchema.safeParse(input)
  if (!parsed.success) {
    throw new FixtureValidationError(
      `Part 4 fixture validation failed: ${formatIssues(parsed.error)}`,
      { cause: parsed.error },
    )
  }

  const fixture = parsed.data
  const questionIds = fixture.questions.map((item) => item.question_id)
  const answerPointIds = fixture.answerPoints.map((item) => item.answer_point_id)
  const sourceIds = fixture.sources.map((item) => item.source_id)
  const sourceReferenceIds = fixture.sourceReferences.map(
    (item) => item.source_reference_id,
  )
  const modelAnswerIds = fixture.modelAnswers.map((item) => item.answer_id)

  ensureUniqueIds(questionIds, 'questions')
  ensureUniqueIds(answerPointIds, 'answerPoints')
  ensureUniqueIds(sourceIds, 'sources')
  ensureUniqueIds(sourceReferenceIds, 'sourceReferences')
  ensureUniqueIds(modelAnswerIds, 'modelAnswers')

  ensureExpectedValues(questionIds, EXPECTED_QUESTION_IDS, 'question IDs')

  if (fixture.questions.length !== 6) {
    throw new FixtureValidationError('questions: development fixture must contain exactly 6')
  }
  if (fixture.answerPoints.length !== 6) {
    throw new FixtureValidationError(
      'AnswerPoint: development fixture must contain exactly 6',
    )
  }
  if (fixture.sources.length !== 1) {
    throw new FixtureValidationError('Source: development fixture must contain exactly 1')
  }
  if (fixture.sourceReferences.length !== 12) {
    throw new FixtureValidationError(
      'SourceReference: development fixture must contain exactly 12',
    )
  }
  if (fixture.modelAnswers.length !== 0) {
    throw new FixtureValidationError(
      'ModelAnswer: development fixture must contain exactly 0',
    )
  }

  if (fixture.questions.some((question) => question.part !== 4)) {
    throw new FixtureValidationError('questions.part: all development questions must be Part 4')
  }
  if (fixture.questions.some((question) => question.question_status !== 'raw')) {
    throw new FixtureValidationError(
      'questions.question_status: all development questions must remain raw',
    )
  }

  if (
    fixture.answerPoints.some(
      (answerPoint) =>
        answerPoint.point_type !== 'unclassified' ||
        answerPoint.point_status !== 'raw',
    )
  ) {
    throw new FixtureValidationError(
      'AnswerPoint: every development point must be raw and unclassified',
    )
  }
  for (const questionId of EXPECTED_QUESTION_IDS) {
    if (
      fixture.answerPoints.filter(
        (answerPoint) => answerPoint.question_id === questionId,
      ).length !== 1
    ) {
      throw new FixtureValidationError(
        `AnswerPoint: Question ${questionId} must have exactly one point`,
      )
    }
  }

  const [source] = fixture.sources
  if (
    source.source_id !== 'src-001' ||
    source.provenance_status !== 'unverified_source'
  ) {
    throw new FixtureValidationError(
      'Source: sole development source must be unverified src-001',
    )
  }

  if (
    fixture.sourceReferences.some(
      (reference) =>
        reference.source_id !== 'src-001' ||
        reference.relationship_kind !== 'extracted_from' ||
        reference.verification_status !== 'unverified',
    )
  ) {
    throw new FixtureValidationError(
      'SourceReference: all development references must be unverified extractions from src-001',
    )
  }

  const questionIdSet = new Set(questionIds)
  const answerPointIdSet = new Set(answerPointIds)
  const sourceIdSet = new Set(sourceIds)
  const sourceReferenceIdSet = new Set(sourceReferenceIds)

  for (const questionId of EXPECTED_QUESTION_IDS) {
    if (
      fixture.sourceReferences.filter(
        (reference) =>
          reference.target_type === 'question' &&
          reference.target_id === questionId,
      ).length !== 1
    ) {
      throw new FixtureValidationError(
        `SourceReference cardinality: Question ${questionId} must have exactly one reference`,
      )
    }
  }
  for (const answerPointId of answerPointIds) {
    if (
      fixture.sourceReferences.filter(
        (reference) =>
          reference.target_type === 'answer_point' &&
          reference.target_id === answerPointId,
      ).length !== 1
    ) {
      throw new FixtureValidationError(
        `SourceReference cardinality: AnswerPoint ${answerPointId} must have exactly one reference`,
      )
    }
  }

  for (const answerPoint of fixture.answerPoints) {
    if (!questionIdSet.has(answerPoint.question_id)) {
      throw new FixtureValidationError(
        `answerPoints.${answerPoint.answer_point_id}.question_id: unknown Question`,
      )
    }
    for (const sourceReferenceId of answerPoint.source_reference_ids ?? []) {
      if (!sourceReferenceIdSet.has(sourceReferenceId)) {
        throw new FixtureValidationError(
          `answerPoints.${answerPoint.answer_point_id}.source_reference_ids: unknown SourceReference`,
        )
      }
    }
  }

  for (const reference of fixture.sourceReferences) {
    if (!sourceIdSet.has(reference.source_id)) {
      throw new FixtureValidationError(
        `sourceReferences.${reference.source_reference_id}.source_id: unknown Source`,
      )
    }
    const targetExists =
      (reference.target_type === 'question' && questionIdSet.has(reference.target_id)) ||
      (reference.target_type === 'answer_point' &&
        answerPointIdSet.has(reference.target_id)) ||
      (reference.target_type === 'model_answer' &&
        modelAnswerIds.includes(reference.target_id))
    if (!targetExists) {
      throw new FixtureValidationError(
        `sourceReferences.${reference.source_reference_id}.target_id: unknown fixture target`,
      )
    }
  }

  for (const answer of fixture.modelAnswers) {
    if (answer.answer_target_type === 'question' && !questionIdSet.has(answer.answer_target_id)) {
      throw new FixtureValidationError(
        `modelAnswers.${answer.answer_id}.answer_target_id: unknown Question`,
      )
    }
  }

  const counts = fixture.manifest.counts
  const countPairs: Array<[number, number, string]> = [
    [counts.question, fixture.questions.length, 'question'],
    [counts.answer_point, fixture.answerPoints.length, 'answer_point'],
    [counts.source, fixture.sources.length, 'source'],
    [counts.source_reference, fixture.sourceReferences.length, 'source_reference'],
    [counts.model_answer, fixture.modelAnswers.length, 'model_answer'],
  ]
  for (const [manifestCount, actualCount, label] of countPairs) {
    if (manifestCount !== actualCount) {
      throw new FixtureValidationError(
        `manifest.counts.${label}: expected ${actualCount}, received ${manifestCount}`,
      )
    }
  }

  ensureExactIds(questionIds, fixture.manifest.ids.question, 'manifest.ids.question')
  ensureExactIds(
    answerPointIds,
    fixture.manifest.ids.answer_point,
    'manifest.ids.answer_point',
  )
  ensureExactIds(sourceIds, fixture.manifest.ids.source, 'manifest.ids.source')
  ensureExactIds(
    sourceReferenceIds,
    fixture.manifest.ids.source_reference,
    'manifest.ids.source_reference',
  )
  ensureExactIds(
    modelAnswerIds,
    fixture.manifest.ids.model_answer,
    'manifest.ids.model_answer',
  )

  return fixture
}
