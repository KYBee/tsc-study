import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { Part4ReviewDecision } from '../domain/entities'

export const DEFAULT_REVIEW_DB_NAME = 'tsc-study-data-review-v1'
export const REVIEW_DB_VERSION = 1
export const PART4_REVIEW_DECISIONS_STORE = 'part4ReviewDecisions'
export const REVIEW_DECISION_QUESTION_INDEX = 'by-question-id'

export interface TscStudyDataReviewSchema extends DBSchema {
  [PART4_REVIEW_DECISIONS_STORE]: {
    key: string
    value: Part4ReviewDecision
    indexes: {
      [REVIEW_DECISION_QUESTION_INDEX]: string
    }
  }
}

export function openTscStudyDataReviewDatabase(
  databaseName = DEFAULT_REVIEW_DB_NAME,
): Promise<IDBPDatabase<TscStudyDataReviewSchema>> {
  return openDB<TscStudyDataReviewSchema>(databaseName, REVIEW_DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const store = database.createObjectStore(
          PART4_REVIEW_DECISIONS_STORE,
          { keyPath: 'review_decision_id' },
        )
        store.createIndex(REVIEW_DECISION_QUESTION_INDEX, 'question_id', {
          unique: true,
        })
      }
    },
  })
}

export function deleteTscStudyDataReviewDatabase(
  databaseName = DEFAULT_REVIEW_DB_NAME,
): Promise<void> {
  return deleteDB(databaseName)
}
