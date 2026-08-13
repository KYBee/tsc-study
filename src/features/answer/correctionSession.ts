import { z } from 'zod'

import type {
  CorrectionMode,
  CorrectionProviderResult,
} from '../../domain/correction'
import type { InputLanguage, PartNumber } from '../../domain/entities'
import {
  PART4_FIXTURE_DATASET_ID,
  TEXT_PARTS_FIXTURE_DATASET_ID,
} from '../../data/fixtureLoader'

const SESSION_SCHEMA_VERSION = 2 as const
const SESSION_KEY_PREFIX = 'tsc-study:text-parts:v2:correction-session:'
const LEGACY_SESSION_KEY_PREFIX = 'tsc-study:part4-fixture:v1:correction-session:'

const changeSchema = z
  .object({
    before: z.string(),
    after: z.string(),
    reason: z.string(),
  })
  .strict()

const structureSegmentSchema = z
  .object({
    label: z.string(),
    content: z.string(),
  })
  .strict()

const correctionResultSchema = z
  .object({
    corrected_zh: z.string(),
    pinyin: z.string(),
    ko: z.string(),
    changes: z.array(changeSchema),
    structure_segments: z.array(structureSegmentSchema),
    relevance_note: z.string(),
    uncertainties: z.array(z.object({ message: z.string() }).strict()),
    key_expressions: z.array(z.string()).optional(),
    message: z.string().optional(),
  })
  .strict()

const providerResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('success'),
      original_input: z.string(),
      result: correctionResultSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal('unsupported_by_mock'),
      original_input: z.string(),
      message: z.string(),
      explanation: z.string(),
    })
    .strict(),
  z
    .object({
      status: z.literal('failure'),
      original_input: z.string(),
      message: z.string(),
      error_code: z.string().optional(),
    })
    .strict(),
])

const correctionSessionSchema = z
  .object({
    schema_version: z.literal(SESSION_SCHEMA_VERSION),
    dataset_id: z.literal(TEXT_PARTS_FIXTURE_DATASET_ID),
    target_type: z.literal('question'),
    question_id: z.string().min(1),
    part: z.union([
      z.literal(1),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    correction_mode: z.enum(['minimal', 'natural', 'level_8_expansion']),
    input_language: z.enum(['ko', 'zh', 'mixed']),
    original_input: z.string(),
    provider_result: providerResultSchema.nullable(),
    created_at: z.string().min(1),
  })
  .strict()

const legacyCorrectionSessionSchema = z
  .object({
    schema_version: z.literal(1),
    dataset_id: z.literal(PART4_FIXTURE_DATASET_ID),
    question_id: z.string().min(1),
    correction_mode: z.enum(['minimal', 'natural', 'level_8_expansion']),
    input_language: z.enum(['ko', 'zh', 'mixed']),
    original_input: z.string(),
    provider_result: providerResultSchema.nullable(),
    created_at: z.string().min(1),
  })
  .strict()

export interface CorrectionSession {
  schema_version: typeof SESSION_SCHEMA_VERSION
  dataset_id: typeof TEXT_PARTS_FIXTURE_DATASET_ID
  target_type: 'question'
  question_id: string
  part: Extract<PartNumber, 1 | 3 | 4 | 5 | 6>
  correction_mode: CorrectionMode
  input_language: InputLanguage
  original_input: string
  provider_result: CorrectionProviderResult | null
  created_at: string
}

export type NewCorrectionSession = Pick<
  CorrectionSession,
  | 'question_id'
  | 'correction_mode'
  | 'input_language'
  | 'original_input'
  | 'provider_result'
>

const getDefaultStorage = (): Storage => window.sessionStorage

export const getCorrectionSessionKey = (questionId: string) =>
  `${SESSION_KEY_PREFIX}${questionId}`

const inferTextPart = (
  questionId: string,
): Extract<PartNumber, 1 | 3 | 4 | 5 | 6> => {
  const part = Number(questionId.match(/^P([13456])-/)?.[1])
  if (![1, 3, 4, 5, 6].includes(part)) {
    throw new Error(`교정 세션이 지원하지 않는 question_id: ${questionId}`)
  }
  return part as Extract<PartNumber, 1 | 3 | 4 | 5 | 6>
}

export const createCorrectionSession = (
  session: NewCorrectionSession,
  now: () => string = () => new Date().toISOString(),
): CorrectionSession => ({
  schema_version: SESSION_SCHEMA_VERSION,
  dataset_id: TEXT_PARTS_FIXTURE_DATASET_ID,
  target_type: 'question',
  ...session,
  part: inferTextPart(session.question_id),
  created_at: now(),
})

export const saveCorrectionSession = (
  session: CorrectionSession,
  storage: Storage = getDefaultStorage(),
) => {
  const validated = correctionSessionSchema.parse(session)
  storage.setItem(getCorrectionSessionKey(validated.question_id), JSON.stringify(validated))
  storage.removeItem(`${LEGACY_SESSION_KEY_PREFIX}${validated.question_id}`)
}

export const loadCorrectionSession = (
  questionId: string,
  storage: Storage = getDefaultStorage(),
): CorrectionSession | undefined => {
  const key = getCorrectionSessionKey(questionId)
  const stored = storage.getItem(key)

  if (stored !== null) {
    try {
      const validated = correctionSessionSchema.parse(JSON.parse(stored))
      if (validated.question_id !== questionId) {
        storage.removeItem(key)
        return undefined
      }
      return validated
    } catch {
      storage.removeItem(key)
    }
  }

  const legacyKey = `${LEGACY_SESSION_KEY_PREFIX}${questionId}`
  const legacyStored = storage.getItem(legacyKey)
  if (legacyStored === null) return undefined
  try {
    const legacy = legacyCorrectionSessionSchema.parse(JSON.parse(legacyStored))
    if (legacy.question_id !== questionId) {
      storage.removeItem(legacyKey)
      return undefined
    }
    return {
      schema_version: SESSION_SCHEMA_VERSION,
      dataset_id: TEXT_PARTS_FIXTURE_DATASET_ID,
      target_type: 'question',
      question_id: legacy.question_id,
      part: inferTextPart(legacy.question_id),
      correction_mode: legacy.correction_mode,
      input_language: legacy.input_language,
      original_input: legacy.original_input,
      provider_result: legacy.provider_result,
      created_at: legacy.created_at,
    }
  } catch {
    storage.removeItem(legacyKey)
    return undefined
  }
}

export const clearCorrectionSession = (
  questionId: string,
  storage: Storage = getDefaultStorage(),
) => {
  storage.removeItem(getCorrectionSessionKey(questionId))
  storage.removeItem(`${LEGACY_SESSION_KEY_PREFIX}${questionId}`)
}
