import { z } from 'zod'

import type {
  CorrectionMode,
  CorrectionProviderResult,
} from '../../domain/correction'
import type { InputLanguage } from '../../domain/entities'
import { PART4_FIXTURE_DATASET_ID } from '../../data/fixtureLoader'

const SESSION_SCHEMA_VERSION = 1 as const
const SESSION_KEY_PREFIX = 'tsc-study:part4-fixture:v1:correction-session:'

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
  dataset_id: typeof PART4_FIXTURE_DATASET_ID
  question_id: string
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

export const createCorrectionSession = (
  session: NewCorrectionSession,
  now: () => string = () => new Date().toISOString(),
): CorrectionSession => ({
  schema_version: SESSION_SCHEMA_VERSION,
  dataset_id: PART4_FIXTURE_DATASET_ID,
  ...session,
  created_at: now(),
})

export const saveCorrectionSession = (
  session: CorrectionSession,
  storage: Storage = getDefaultStorage(),
) => {
  const validated = correctionSessionSchema.parse(session)
  storage.setItem(getCorrectionSessionKey(validated.question_id), JSON.stringify(validated))
}

export const loadCorrectionSession = (
  questionId: string,
  storage: Storage = getDefaultStorage(),
): CorrectionSession | undefined => {
  const key = getCorrectionSessionKey(questionId)
  const stored = storage.getItem(key)
  if (stored === null) {
    return undefined
  }

  try {
    const validated = correctionSessionSchema.parse(JSON.parse(stored))
    if (validated.question_id !== questionId) {
      storage.removeItem(key)
      return undefined
    }
    return validated
  } catch {
    storage.removeItem(key)
    return undefined
  }
}

export const clearCorrectionSession = (
  questionId: string,
  storage: Storage = getDefaultStorage(),
) => {
  storage.removeItem(getCorrectionSessionKey(questionId))
}
