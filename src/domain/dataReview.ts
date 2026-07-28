import { z } from 'zod'

import type {
  AnswerPoint,
  Part4ReviewDecision,
  Part4ReviewField,
  Part4ReviewFieldStatus,
  Question,
  SourceReference,
} from './entities'
import {
  answerPointSchema,
  questionSchema,
  sourceReferenceSchema,
} from './validation'

export const PART4_REVIEW_DATASET_ID = 'part4-review-fixture-v1' as const
export const PART4_REVIEW_SCHEMA_VERSION =
  'part4-review-decision-v1' as const
export const PART4_REVIEW_FIELDS = [
  'chinese_text',
  'pinyin',
  'korean_translation',
  'question_type',
  'answer_point',
  'source_locator',
  'claimed_source_metadata',
] as const satisfies readonly Part4ReviewField[]

export const part4ReviewFieldStatusSchema = z.enum([
  'approved',
  'needs_fix',
  'not_checked',
])

const fieldDecisionsSchema = z
  .object({
    chinese_text: part4ReviewFieldStatusSchema,
    pinyin: part4ReviewFieldStatusSchema,
    korean_translation: part4ReviewFieldStatusSchema,
    question_type: part4ReviewFieldStatusSchema,
    answer_point: part4ReviewFieldStatusSchema,
    source_locator: part4ReviewFieldStatusSchema,
    claimed_source_metadata: part4ReviewFieldStatusSchema,
  })
  .strict()

const isoDateTimeSchema = z.iso.datetime({ offset: true })
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const part4ReviewDecisionSchema = z
  .object({
    review_decision_id: z.string().min(1).max(100),
    dataset_id: z.literal(PART4_REVIEW_DATASET_ID),
    question_id: z.string().regex(/^P4-\d{3}$/),
    field_decisions: fieldDecisionsSchema,
    overall_status: z.enum(['approved', 'needs_fix', 'deferred']),
    reviewer_note: z.string().max(10_000),
    reviewed_by: z.string().min(1).max(200),
    reviewed_at: isoDateTimeSchema,
    source_question_hash: sha256Schema,
    source_answer_point_hash: sha256Schema,
    decision_version: z.literal(1),
  })
  .strict()
  .superRefine((decision, context) => {
    const values = PART4_REVIEW_FIELDS.map(
      (field) => decision.field_decisions[field],
    )
    if (
      decision.review_decision_id !==
      `p4-review-decision-${decision.question_id}`
    ) {
      context.addIssue({
        code: 'custom',
        path: ['review_decision_id'],
        message: 'question_id와 일치하는 결정 ID가 필요합니다',
      })
    }
    if (
      decision.overall_status === 'approved' &&
      values.some((value) => value !== 'approved')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['overall_status'],
        message: '모든 필드가 승인되어야 전체 승인할 수 있습니다',
      })
    }
    if (decision.overall_status === 'needs_fix') {
      if (!values.includes('needs_fix')) {
        context.addIssue({
          code: 'custom',
          path: ['overall_status'],
          message: '수정 필요 필드가 하나 이상 있어야 합니다',
        })
      }
      if (!decision.reviewer_note.trim()) {
        context.addIssue({
          code: 'custom',
          path: ['reviewer_note'],
          message: '수정 필요 사유를 입력해 주세요',
        })
      }
    }
    if (
      decision.overall_status === 'deferred' &&
      values.includes('needs_fix')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['overall_status'],
        message: '수정 필요 필드가 있으면 전체 상태도 수정 필요여야 합니다',
      })
    }
  })

const reviewQueueItemSchema = z
  .object({
    review_item_id: z.string().min(1),
    target_type: z.string(),
    issue_type: z.string(),
    priority: z.enum(['blocking', 'important', 'later']),
    reason: z.string(),
    source_locator: z.string(),
    review_status: z.string(),
    notes: z.string(),
  })
  .strict()

export const part4ReviewItemSchema = z
  .object({
    review_item_id: z.string().min(1),
    dataset_id: z.literal(PART4_REVIEW_DATASET_ID),
    question_id: z.string().regex(/^P4-\d{3}$/),
    question: questionSchema,
    answer_point: answerPointSchema,
    question_source_references: z.array(sourceReferenceSchema).min(1),
    answer_point_source_references: z.array(sourceReferenceSchema).min(1),
    review_queue_items: z.array(reviewQueueItemSchema),
    required_review_fields: z.tuple([
      z.literal('chinese_text'),
      z.literal('pinyin'),
      z.literal('korean_translation'),
      z.literal('question_type'),
      z.literal('answer_point'),
      z.literal('source_locator'),
      z.literal('claimed_source_metadata'),
    ]),
    source_question_hash: sha256Schema,
    source_answer_point_hash: sha256Schema,
  })
  .strict()

export interface Part4ReviewItem {
  review_item_id: string
  dataset_id: typeof PART4_REVIEW_DATASET_ID
  question_id: string
  question: Question
  answer_point: AnswerPoint
  question_source_references: SourceReference[]
  answer_point_source_references: SourceReference[]
  review_queue_items: Array<{
    review_item_id: string
    target_type: string
    issue_type: string
    priority: 'blocking' | 'important' | 'later'
    reason: string
    source_locator: string
    review_status: string
    notes: string
  }>
  required_review_fields: [...typeof PART4_REVIEW_FIELDS]
  source_question_hash: string
  source_answer_point_hash: string
}

export const part4ReviewItemsSchema = z
  .array(part4ReviewItemSchema)
  .length(50)
  .superRefine((items, context) => {
    const expected = Array.from(
      { length: 50 },
      (_, index) => `P4-${String(index + 1).padStart(3, '0')}`,
    )
    if (items.some((item, index) => item.question_id !== expected[index])) {
      context.addIssue({
        code: 'custom',
        message: 'P4-001부터 P4-050까지 안정적인 순서가 필요합니다',
      })
    }
    for (const item of items) {
      if (
        item.question.question_id !== item.question_id ||
        item.answer_point.question_id !== item.question_id
      ) {
        context.addIssue({
          code: 'custom',
          message: `${item.question_id}의 참조가 일치하지 않습니다`,
        })
      }
    }
  })

export const part4ReviewDecisionExportSchema = z
  .object({
    dataset_id: z.literal(PART4_REVIEW_DATASET_ID),
    review_schema_version: z.literal(PART4_REVIEW_SCHEMA_VERSION),
    exported_at: isoDateTimeSchema,
    reviewer: z.string().max(200),
    decisions: z.array(part4ReviewDecisionSchema).max(50),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.decisions.map((decision) => decision.question_id)
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        path: ['decisions'],
        message: '같은 Question의 결정이 중복되었습니다',
      })
    }
  })

export type Part4ReviewDecisionExport = z.infer<
  typeof part4ReviewDecisionExportSchema
>

export function calculateReviewOverallStatus(
  fieldDecisions: Record<Part4ReviewField, Part4ReviewFieldStatus>,
): Part4ReviewDecision['overall_status'] {
  const values = PART4_REVIEW_FIELDS.map((field) => fieldDecisions[field])
  if (values.includes('needs_fix')) return 'needs_fix'
  if (values.every((value) => value === 'approved')) return 'approved'
  return 'deferred'
}

export function createEmptyFieldDecisions(): Record<
  Part4ReviewField,
  Part4ReviewFieldStatus
> {
  return Object.fromEntries(
    PART4_REVIEW_FIELDS.map((field) => [field, 'not_checked']),
  ) as Record<Part4ReviewField, Part4ReviewFieldStatus>
}

export function isReviewDecisionStale(
  decision: Part4ReviewDecision,
  item: Part4ReviewItem,
): boolean {
  return (
    decision.source_question_hash !== item.source_question_hash ||
    decision.source_answer_point_hash !== item.source_answer_point_hash
  )
}

export function isPromotionEligible(
  decision: Part4ReviewDecision | undefined,
  item: Part4ReviewItem,
): boolean {
  return Boolean(
    decision &&
      decision.overall_status === 'approved' &&
      !isReviewDecisionStale(decision, item) &&
      PART4_REVIEW_FIELDS.every(
        (field) => decision.field_decisions[field] === 'approved',
      ),
  )
}
