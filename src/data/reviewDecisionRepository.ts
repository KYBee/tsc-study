import type { Part4ReviewDecision } from '../domain/entities'
import { part4ReviewDecisionSchema } from '../domain/dataReview'
import {
  DEFAULT_REVIEW_DB_NAME,
  deleteTscStudyDataReviewDatabase,
  openTscStudyDataReviewDatabase,
  PART4_REVIEW_DECISIONS_STORE,
  REVIEW_DECISION_QUESTION_INDEX,
} from './reviewIndexedDb'

export interface ReviewDecisionRepository {
  getByQuestionId(questionId: string): Promise<Part4ReviewDecision | undefined>
  list(): Promise<Part4ReviewDecision[]>
  upsert(decision: Part4ReviewDecision): Promise<Part4ReviewDecision>
  upsertMany(decisions: Part4ReviewDecision[]): Promise<void>
  clear(): Promise<void>
  close(): Promise<void>
  destroy(): Promise<void>
}

export interface ReviewDecisionRepositoryOptions {
  databaseName?: string
}

export function createReviewDecisionRepository(
  options: ReviewDecisionRepositoryOptions = {},
): ReviewDecisionRepository {
  const databaseName = options.databaseName ?? DEFAULT_REVIEW_DB_NAME
  const databasePromise = openTscStudyDataReviewDatabase(databaseName)

  async function getByQuestionId(questionId: string) {
    const database = await databasePromise
    return database.getFromIndex(
      PART4_REVIEW_DECISIONS_STORE,
      REVIEW_DECISION_QUESTION_INDEX,
      questionId,
    )
  }

  async function list() {
    const database = await databasePromise
    return (await database.getAll(PART4_REVIEW_DECISIONS_STORE)).sort(
      (left, right) => left.question_id.localeCompare(right.question_id, 'en'),
    )
  }

  async function upsert(decision: Part4ReviewDecision) {
    const validated = part4ReviewDecisionSchema.parse(decision)
    const database = await databasePromise
    await database.put(PART4_REVIEW_DECISIONS_STORE, validated)
    return validated
  }

  async function upsertMany(decisions: Part4ReviewDecision[]) {
    const validated = decisions.map((decision) =>
      part4ReviewDecisionSchema.parse(decision),
    )
    const database = await databasePromise
    const transaction = database.transaction(
      PART4_REVIEW_DECISIONS_STORE,
      'readwrite',
    )
    for (const decision of validated) {
      await transaction.store.put(decision)
    }
    await transaction.done
  }

  async function clear() {
    const database = await databasePromise
    await database.clear(PART4_REVIEW_DECISIONS_STORE)
  }

  async function close() {
    const database = await databasePromise
    database.close()
  }

  async function destroy() {
    await close()
    await deleteTscStudyDataReviewDatabase(databaseName)
  }

  return { getByQuestionId, list, upsert, upsertMany, clear, close, destroy }
}
