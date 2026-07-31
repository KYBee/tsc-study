import {
  deleteDB,
  openDB,
  type DBSchema,
  type IDBPDatabase,
} from 'idb'

import type {
  StoredPersonalCorrection,
  StoredPracticeDraft,
  StoredRecallAttempt,
  StoredReusablePhrase,
  StoredReviewState,
  StoredUserAnswer,
} from './userDataRepository'

export const DEFAULT_USER_DATA_DB_NAME = 'tsc-study-part4-fixture-v1'
export const USER_DATA_DB_VERSION = 5

export const USER_ANSWERS_STORE = 'userAnswers'
export const REVIEW_STATES_STORE = 'reviewStates'
export const CORRECTIONS_STORE = 'corrections'
export const PRACTICE_DRAFTS_STORE = 'practiceDrafts'
export const REUSABLE_PHRASES_STORE = 'reusablePhrases'
export const RECALL_ATTEMPTS_STORE = 'recallAttempts'

export const USER_ANSWER_QUESTION_INDEX = 'by-question-id'
export const REVIEW_STATE_TARGET_INDEX = 'by-target'
export const REVIEW_STATE_TARGET_ID_INDEX = 'by-target-id'
export const CORRECTION_USER_ANSWER_INDEX = 'by-user-answer-id'
export const PRACTICE_DRAFT_QUESTION_INDEX = 'by-question-id'
export const PRACTICE_DRAFT_TARGET_INDEX = 'by-target'
export const REUSABLE_PHRASE_QUESTION_INDEX = 'by-question-id'
export const REUSABLE_PHRASE_TARGET_INDEX = 'by-source-target'
export const RECALL_ATTEMPT_QUESTION_INDEX = 'by-question-id'
export const RECALL_ATTEMPT_TARGET_INDEX = 'by-target'

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
      [PRACTICE_DRAFT_TARGET_INDEX]: [
        'question' | 'visual_question' | 'visual_set',
        string,
      ]
    }
  }
  [REUSABLE_PHRASES_STORE]: {
    key: string
    value: StoredReusablePhrase
    indexes: {
      [REUSABLE_PHRASE_QUESTION_INDEX]: string
      [REUSABLE_PHRASE_TARGET_INDEX]: [
        'question' | 'visual_question' | 'visual_set',
        string,
      ]
    }
  }
  [RECALL_ATTEMPTS_STORE]: {
    key: string
    value: StoredRecallAttempt
    indexes: {
      [RECALL_ATTEMPT_QUESTION_INDEX]: string
      [RECALL_ATTEMPT_TARGET_INDEX]: [
        'question' | 'visual_question' | 'visual_set',
        string,
      ]
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
      async upgrade(database, oldVersion, _newVersion, transaction) {
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
        if (oldVersion < 3) {
          const phrases = database.createObjectStore(REUSABLE_PHRASES_STORE, {
            keyPath: 'reusable_phrase_id',
          })
          phrases.createIndex(
            REUSABLE_PHRASE_QUESTION_INDEX,
            'source_question_id',
          )
          const attempts = database.createObjectStore(RECALL_ATTEMPTS_STORE, {
            keyPath: 'recall_attempt_id',
          })
          attempts.createIndex(
            RECALL_ATTEMPT_QUESTION_INDEX,
            'question_id',
          )
        }
        if (oldVersion < 4) {
          const drafts = transaction.objectStore(PRACTICE_DRAFTS_STORE)
          drafts.createIndex(
            PRACTICE_DRAFT_TARGET_INDEX,
            ['target_type', 'target_id'],
            { unique: true },
          )
          let draftCursor = await drafts.openCursor()
          while (draftCursor) {
            const value = draftCursor.value
            await draftCursor.update({
              ...value,
              target_type: value.target_type ?? 'question',
              target_id: value.target_id ?? value.question_id,
            })
            draftCursor = await draftCursor.continue()
          }

          const phrases = transaction.objectStore(REUSABLE_PHRASES_STORE)
          phrases.createIndex(
            REUSABLE_PHRASE_TARGET_INDEX,
            ['source_target_type', 'source_target_id'],
          )
          let phraseCursor = await phrases.openCursor()
          while (phraseCursor) {
            const value = phraseCursor.value
            await phraseCursor.update({
              ...value,
              source_target_type: value.source_target_type ?? 'question',
              source_target_id:
                value.source_target_id ?? value.source_question_id,
            })
            phraseCursor = await phraseCursor.continue()
          }

          const attempts = transaction.objectStore(RECALL_ATTEMPTS_STORE)
          attempts.createIndex(
            RECALL_ATTEMPT_TARGET_INDEX,
            ['target_type', 'target_id'],
          )
          let attemptCursor = await attempts.openCursor()
          while (attemptCursor) {
            const value = attemptCursor.value
            await attemptCursor.update({
              ...value,
              target_type: value.target_type ?? 'question',
              target_id: value.target_id ?? value.question_id,
            })
            attemptCursor = await attemptCursor.continue()
          }
        }
        if (oldVersion < 5) {
          // v5 widens existing compound-index values to `visual_set`.
          // IndexedDB indexes are string-based and require no destructive
          // store/index rebuild, so every v4 record remains byte-for-byte intact.
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
