import {
  deleteDB,
  openDB,
  type DBSchema,
  type IDBPDatabase,
} from 'idb'

import type {
  StoredPersonalCorrection,
  StoredPracticeDraft,
  StoredReviewState,
  StoredUserAnswer,
} from './userDataRepository'

export const DEFAULT_USER_DATA_DB_NAME = 'tsc-study-part4-fixture-v1'
export const USER_DATA_DB_VERSION = 2

export const USER_ANSWERS_STORE = 'userAnswers'
export const REVIEW_STATES_STORE = 'reviewStates'
export const CORRECTIONS_STORE = 'corrections'
export const PRACTICE_DRAFTS_STORE = 'practiceDrafts'

export const USER_ANSWER_QUESTION_INDEX = 'by-question-id'
export const REVIEW_STATE_TARGET_INDEX = 'by-target'
export const REVIEW_STATE_TARGET_ID_INDEX = 'by-target-id'
export const CORRECTION_USER_ANSWER_INDEX = 'by-user-answer-id'
export const PRACTICE_DRAFT_QUESTION_INDEX = 'by-question-id'

export interface TscStudyUserDataSchema extends DBSchema {
  [USER_ANSWERS_STORE]: {
    key: string
    value: StoredUserAnswer
    indexes: {
      [USER_ANSWER_QUESTION_INDEX]: string
    }
  }
  [REVIEW_STATES_STORE]: {
    key: string
    value: StoredReviewState
    indexes: {
      [REVIEW_STATE_TARGET_INDEX]: [
        StoredReviewState['target_type'],
        string,
      ]
      [REVIEW_STATE_TARGET_ID_INDEX]: string
    }
  }
  [CORRECTIONS_STORE]: {
    key: string
    value: StoredPersonalCorrection
    indexes: {
      [CORRECTION_USER_ANSWER_INDEX]: string
    }
  }
  [PRACTICE_DRAFTS_STORE]: {
    key: string
    value: StoredPracticeDraft
    indexes: {
      [PRACTICE_DRAFT_QUESTION_INDEX]: string
    }
  }
}

export function openTscStudyUserDatabase(
  databaseName = DEFAULT_USER_DATA_DB_NAME,
): Promise<IDBPDatabase<TscStudyUserDataSchema>> {
  return openDB<TscStudyUserDataSchema>(
    databaseName,
    USER_DATA_DB_VERSION,
    {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const userAnswers = database.createObjectStore(USER_ANSWERS_STORE, {
            keyPath: 'user_answer_id',
          })
          userAnswers.createIndex(
            USER_ANSWER_QUESTION_INDEX,
            'question_id',
            { unique: true },
          )

          const reviewStates = database.createObjectStore(REVIEW_STATES_STORE, {
            keyPath: 'review_state_id',
          })
          reviewStates.createIndex(
            REVIEW_STATE_TARGET_INDEX,
            ['target_type', 'target_id'],
            { unique: true },
          )
          reviewStates.createIndex(
            REVIEW_STATE_TARGET_ID_INDEX,
            'target_id',
          )

          const corrections = database.createObjectStore(CORRECTIONS_STORE, {
            keyPath: 'correction_id',
          })
          corrections.createIndex(
            CORRECTION_USER_ANSWER_INDEX,
            'user_answer_id',
          )
        }

        if (oldVersion < 2) {
          const practiceDrafts = database.createObjectStore(
            PRACTICE_DRAFTS_STORE,
            { keyPath: 'practice_draft_id' },
          )
          practiceDrafts.createIndex(
            PRACTICE_DRAFT_QUESTION_INDEX,
            'question_id',
            { unique: true },
          )
        }
      },
    },
  )
}

export function deleteTscStudyUserDatabase(
  databaseName = DEFAULT_USER_DATA_DB_NAME,
): Promise<void> {
  return deleteDB(databaseName)
}
