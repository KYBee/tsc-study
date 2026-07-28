import {
  isReviewDecisionStale,
  PART4_REVIEW_DATASET_ID,
  PART4_REVIEW_SCHEMA_VERSION,
  part4ReviewDecisionExportSchema,
  type Part4ReviewDecisionExport,
  type Part4ReviewItem,
} from '../../domain/dataReview'
import type { Part4ReviewDecision } from '../../domain/entities'

export const MAX_REVIEW_IMPORT_BYTES = 1_000_000

export interface ImportRejection {
  question_id?: string
  reason: string
}

export interface ReviewImportPreview {
  newDecisions: Part4ReviewDecision[]
  overwriteDecisions: Part4ReviewDecision[]
  identicalDecisions: Part4ReviewDecision[]
  staleDecisions: Part4ReviewDecision[]
  rejectedDecisions: ImportRejection[]
  applicableDecisions: Part4ReviewDecision[]
}

export function buildReviewDecisionExport(
  decisions: Part4ReviewDecision[],
  reviewer: string,
  now: () => string = () => new Date().toISOString(),
): Part4ReviewDecisionExport {
  return part4ReviewDecisionExportSchema.parse({
    dataset_id: PART4_REVIEW_DATASET_ID,
    review_schema_version: PART4_REVIEW_SCHEMA_VERSION,
    exported_at: now(),
    reviewer,
    decisions: [...decisions].sort((left, right) =>
      left.question_id.localeCompare(right.question_id, 'en'),
    ),
  })
}

export function serializeReviewDecisionExport(
  value: Part4ReviewDecisionExport,
): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function sameDecision(
  left: Part4ReviewDecision,
  right: Part4ReviewDecision,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function previewReviewDecisionImport(
  text: string,
  items: Part4ReviewItem[],
  existingDecisions: Part4ReviewDecision[],
): ReviewImportPreview {
  if (new TextEncoder().encode(text).byteLength > MAX_REVIEW_IMPORT_BYTES) {
    throw new Error('검수 결정 파일이 허용 크기를 초과했습니다')
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('올바른 JSON 파일이 아닙니다')
  }
  const imported = part4ReviewDecisionExportSchema.parse(raw)
  const itemByQuestion = new Map(items.map((item) => [item.question_id, item]))
  const existingByQuestion = new Map(
    existingDecisions.map((decision) => [decision.question_id, decision]),
  )
  const preview: ReviewImportPreview = {
    newDecisions: [],
    overwriteDecisions: [],
    identicalDecisions: [],
    staleDecisions: [],
    rejectedDecisions: [],
    applicableDecisions: [],
  }

  for (const decision of imported.decisions) {
    const item = itemByQuestion.get(decision.question_id)
    if (!item) {
      preview.rejectedDecisions.push({
        question_id: decision.question_id,
        reason: '현재 검수 fixture에 없는 question_id입니다',
      })
      continue
    }
    if (isReviewDecisionStale(decision, item)) {
      preview.staleDecisions.push(decision)
      preview.applicableDecisions.push(decision)
      continue
    }
    const existing = existingByQuestion.get(decision.question_id)
    if (!existing) {
      preview.newDecisions.push(decision)
      preview.applicableDecisions.push(decision)
    } else if (sameDecision(existing, decision)) {
      preview.identicalDecisions.push(decision)
    } else {
      preview.overwriteDecisions.push(decision)
      preview.applicableDecisions.push(decision)
    }
  }
  return preview
}

export function downloadReviewDecisionExport(
  value: Part4ReviewDecisionExport,
): void {
  const blob = new Blob([serializeReviewDecisionExport(value)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'part4-review-decisions-v1.json'
  anchor.click()
  URL.revokeObjectURL(url)
}
