import type {
  Correction,
  LearningTargetType,
  PracticeDraft,
  RecallAttempt,
  ReusablePhrase,
  ReviewState,
  UserAnswer,
} from '../domain/entities'
import type { IDBPObjectStore } from 'idb'
import {
  CORRECTIONS_STORE,
  CORRECTION_USER_ANSWER_INDEX,
  DEFAULT_USER_DATA_DB_NAME,
  deleteTscStudyUserDatabase,
  openTscStudyUserDatabase,
  PRACTICE_DRAFTS_STORE,
  PRACTICE_DRAFT_TARGET_INDEX,
  RECALL_ATTEMPTS_STORE,
  RECALL_ATTEMPT_TARGET_INDEX,
  REUSABLE_PHRASES_STORE,
  REVIEW_STATES_STORE,
  REVIEW_STATE_TARGET_INDEX,
  USER_ANSWERS_STORE,
  USER_ANSWER_QUESTION_INDEX,
  type TscStudyUserDataSchema,
} from './indexedDb'

export type UserAnswerInput = Omit<UserAnswer, 'created_at'> & {
  created_at?: string
}

export type StoredUserAnswer = UserAnswer & {
  updated_at: string
}

export type ReviewStateInput = Omit<
  ReviewState,
  'last_reviewed_at' | 'review_count'
> & {
  last_reviewed_at?: string
}

export type StoredReviewState = ReviewState

export type PersonalCorrectionInput = Omit<
  Correction,
  'user_answer_id'
> & {
  user_answer_id?: string
}

export type StoredPersonalCorrection = Correction & {
  user_answer_id: string
  created_at: string
}

export type PracticeDraftInput = Omit<
  PracticeDraft,
  'created_at' | 'updated_at'
> & {
  created_at?: string
}

export type StoredPracticeDraft = PracticeDraft
export type ReusablePhraseInput = Omit<
  ReusablePhrase,
  'created_at' | 'updated_at'
> & { created_at?: string }
export type StoredReusablePhrase = ReusablePhrase
export type RecallAttemptInput = Omit<RecallAttempt, 'attempted_at'> & {
  attempted_at?: string
}
export type StoredRecallAttempt = RecallAttempt

export interface UserDataRepositoryOptions {
  databaseName?: string
  now?: () => string
}

export interface UserDataRepository {
  getUserAnswerByQuestionId(
    questionId: string,
  ): Promise<StoredUserAnswer | undefined>
  listUserAnswers(): Promise<StoredUserAnswer[]>
  upsertUserAnswer(answer: UserAnswerInput): Promise<StoredUserAnswer>
  saveApprovedAnswer(
    answer: UserAnswerInput,
    corrections: PersonalCorrectionInput[],
  ): Promise<StoredUserAnswer>
  deleteUserAnswer(userAnswerId: string): Promise<void>
  getReviewState(
    targetType: ReviewState['target_type'],
    targetId: string,
  ): Promise<StoredReviewState | undefined>
  listReviewStates(): Promise<StoredReviewState[]>
  upsertReviewState(
    reviewState: ReviewStateInput,
  ): Promise<StoredReviewState>
  listPersonalCorrections(): Promise<StoredPersonalCorrection[]>
  deletePersonalCorrectionsForUserAnswer(
    userAnswerId: string,
  ): Promise<void>
  getPracticeDraftByQuestionId(
    questionId: string,
  ): Promise<StoredPracticeDraft | undefined>
  getPracticeDraftByTarget(
    targetType: LearningTargetType,
    targetId: string,
  ): Promise<StoredPracticeDraft | undefined>
  listPracticeDrafts(): Promise<StoredPracticeDraft[]>
  upsertPracticeDraft(
    practiceDraft: PracticeDraftInput,
  ): Promise<StoredPracticeDraft>
  deletePracticeDraft(practiceDraftId: string): Promise<void>
  listReusablePhrases(): Promise<StoredReusablePhrase[]>
  upsertReusablePhrase(
    phrase: ReusablePhraseInput,
  ): Promise<StoredReusablePhrase>
  deleteReusablePhrase(reusablePhraseId: string): Promise<void>
  listRecallAttemptsByQuestionId(
    questionId: string,
  ): Promise<StoredRecallAttempt[]>
  listRecallAttemptsByTarget(
    targetType: LearningTargetType,
    targetId: string,
  ): Promise<StoredRecallAttempt[]>
  listRecallAttempts(): Promise<StoredRecallAttempt[]>
  addRecallAttempt(attempt: RecallAttemptInput): Promise<StoredRecallAttempt>
  close(): Promise<void>
  destroy(): Promise<void>
}

const REVIEW_STATUSES: ReadonlySet<ReviewState['learning_status']> = new Set([
  '못 외움',
  '헷갈림',
  '외움',
])

function compareIdentifiers(left: string, right: string): number {
  return left.localeCompare(right, 'en')
}

function validateUserAnswer(answer: UserAnswerInput): void {
  if (!answer.user_answer_id.trim()) {
    throw new Error('user_answer_id is required')
  }
  if (!answer.question_id.trim()) {
    throw new Error('question_id is required')
  }
  if (answer.save_status !== 'user_approved') {
    throw new Error('Only user-approved answers can be stored')
  }
}

function validateReviewState(reviewState: ReviewStateInput): void {
  if (!reviewState.review_state_id.trim()) {
    throw new Error('review_state_id is required')
  }
  if (!reviewState.target_id.trim()) {
    throw new Error('Review target_id is required')
  }
  if (!REVIEW_STATUSES.has(reviewState.learning_status)) {
    throw new Error('Unsupported learning_status')
  }
}

function validatePracticeDraft(practiceDraft: PracticeDraftInput): void {
  if (!practiceDraft.practice_draft_id.trim()) {
    throw new Error('practice_draft_id is required')
  }
  const targetId = practiceDraft.target_id ?? practiceDraft.question_id
  if (!targetId.trim()) {
    throw new Error('learning target_id is required')
  }
  const hasPlanningKeywords = Object.values(
    practiceDraft.planning_keywords ?? {},
  ).some((keywords) => keywords.some((keyword) => keyword.trim()))
  const hasStoryContent =
    practiceDraft.story_keywords?.some((keyword) => keyword.trim()) ||
    practiceDraft.story_points?.some((point) => point.text.trim())
  if (
    !practiceDraft.original_input.trim() &&
    !hasPlanningKeywords &&
    !hasStoryContent
  ) {
    throw new Error('빈 original_input은 저장할 수 없습니다')
  }
  if (practiceDraft.draft_status !== 'draft') {
    throw new Error('Only draft PracticeDraft records can be stored')
  }
}

function createStoredUserAnswer(
  input: UserAnswerInput,
  existing: StoredUserAnswer | undefined,
  timestamp: string,
): StoredUserAnswer {
  return {
    user_answer_id: existing?.user_answer_id ?? input.user_answer_id,
    learner_ref: input.learner_ref,
    question_id: input.question_id,
    input_language: input.input_language,
    original_input: input.original_input,
    corrected_zh: input.corrected_zh,
    corrected_pinyin: input.corrected_pinyin,
    corrected_ko: input.corrected_ko,
    correction_mode: input.correction_mode,
    change_summary: structuredClone(input.change_summary),
    structure_segments: structuredClone(input.structure_segments),
    save_status: input.save_status,
    created_at: existing?.created_at ?? input.created_at ?? timestamp,
    updated_at: timestamp,
  }
}

function createStoredCorrection(
  input: PersonalCorrectionInput,
  userAnswerId: string,
  timestamp: string,
): StoredPersonalCorrection {
  if (input.source_kind !== 'user_answer' || input.data_scope !== 'personal') {
    throw new Error('Only personal user-answer corrections can be stored')
  }

  return {
    correction_id: input.correction_id,
    wrong_zh: input.wrong_zh,
    correct_zh: input.correct_zh,
    correct_pinyin: input.correct_pinyin,
    correct_ko: input.correct_ko,
    error_type: input.error_type,
    reason: input.reason,
    source_kind: 'user_answer',
    source_reference_ids: input.source_reference_ids
      ? [...input.source_reference_ids]
      : undefined,
    user_answer_id: userAnswerId,
    data_scope: 'personal',
    correction_status: input.correction_status,
    created_at: timestamp,
  }
}

async function deleteCorrectionsInTransaction<
  TransactionStores extends ArrayLike<
    typeof USER_ANSWERS_STORE | typeof CORRECTIONS_STORE
  >,
>(
  correctionStore: IDBPObjectStore<
    TscStudyUserDataSchema,
    TransactionStores,
    typeof CORRECTIONS_STORE,
    'readwrite'
  >,
  userAnswerId: string,
): Promise<void> {
  const correctionKeys = await correctionStore
    .index(CORRECTION_USER_ANSWER_INDEX)
    .getAllKeys(userAnswerId)

  await Promise.all(correctionKeys.map((key) => correctionStore.delete(key)))
}

export function createUserDataRepository(
  options: UserDataRepositoryOptions = {},
): UserDataRepository {
  const databaseName =
    options.databaseName ?? DEFAULT_USER_DATA_DB_NAME
  const now = options.now ?? (() => new Date().toISOString())
  const databasePromise = openTscStudyUserDatabase(databaseName)

  async function getExistingUserAnswer(
    questionId: string,
  ): Promise<StoredUserAnswer | undefined> {
    const database = await databasePromise
    return database.getFromIndex(
      USER_ANSWERS_STORE,
      USER_ANSWER_QUESTION_INDEX,
      questionId,
    )
  }

  async function getUserAnswerByQuestionId(
    questionId: string,
  ): Promise<StoredUserAnswer | undefined> {
    return getExistingUserAnswer(questionId)
  }

  async function listUserAnswers(): Promise<StoredUserAnswer[]> {
    const database = await databasePromise
    const answers = await database.getAll(USER_ANSWERS_STORE)
    return answers.sort((left, right) =>
      compareIdentifiers(left.question_id, right.question_id),
    )
  }

  async function upsertUserAnswer(
    input: UserAnswerInput,
  ): Promise<StoredUserAnswer> {
    validateUserAnswer(input)
    const database = await databasePromise
    const transaction = database.transaction(
      USER_ANSWERS_STORE,
      'readwrite',
    )
    const store = transaction.objectStore(USER_ANSWERS_STORE)
    const existing = await store
      .index(USER_ANSWER_QUESTION_INDEX)
      .get(input.question_id)
    const stored = createStoredUserAnswer(input, existing, now())

    await store.put(stored)
    await transaction.done
    return stored
  }

  async function saveApprovedAnswer(
    input: UserAnswerInput,
    corrections: PersonalCorrectionInput[],
  ): Promise<StoredUserAnswer> {
    validateUserAnswer(input)
    const database = await databasePromise
    const timestamp = now()
    const transaction = database.transaction(
      [USER_ANSWERS_STORE, CORRECTIONS_STORE],
      'readwrite',
    )
    const answerStore = transaction.objectStore(USER_ANSWERS_STORE)
    const existing = await answerStore
      .index(USER_ANSWER_QUESTION_INDEX)
      .get(input.question_id)
    const storedAnswer = createStoredUserAnswer(
      input,
      existing,
      timestamp,
    )

    const actualCorrections = corrections.filter(
      ({ wrong_zh, correct_zh }) => wrong_zh !== correct_zh,
    )
    const storedCorrections = actualCorrections.map((correction) =>
      createStoredCorrection(
        correction,
        storedAnswer.user_answer_id,
        timestamp,
      ),
    )

    await deleteCorrectionsInTransaction(
      transaction.objectStore(CORRECTIONS_STORE),
      storedAnswer.user_answer_id,
    )
    await answerStore.put(storedAnswer)
    const correctionStore = transaction.objectStore(CORRECTIONS_STORE)
    for (const correction of storedCorrections) {
      await correctionStore.put(correction)
    }
    await transaction.done

    return storedAnswer
  }

  async function deleteUserAnswer(userAnswerId: string): Promise<void> {
    const database = await databasePromise
    const transaction = database.transaction(
      [USER_ANSWERS_STORE, CORRECTIONS_STORE],
      'readwrite',
    )

    await deleteCorrectionsInTransaction(
      transaction.objectStore(CORRECTIONS_STORE),
      userAnswerId,
    )
    await transaction.objectStore(USER_ANSWERS_STORE).delete(userAnswerId)
    await transaction.done
  }

  async function getReviewState(
    targetType: ReviewState['target_type'],
    targetId: string,
  ): Promise<StoredReviewState | undefined> {
    const database = await databasePromise
    return database.getFromIndex(
      REVIEW_STATES_STORE,
      REVIEW_STATE_TARGET_INDEX,
      [targetType, targetId],
    )
  }

  async function listReviewStates(): Promise<StoredReviewState[]> {
    const database = await databasePromise
    const reviewStates = await database.getAll(REVIEW_STATES_STORE)
    return reviewStates.sort((left, right) => {
      const targetTypeOrder = compareIdentifiers(
        left.target_type,
        right.target_type,
      )
      return targetTypeOrder === 0
        ? compareIdentifiers(left.target_id, right.target_id)
        : targetTypeOrder
    })
  }

  async function upsertReviewState(
    input: ReviewStateInput,
  ): Promise<StoredReviewState> {
    validateReviewState(input)
    const database = await databasePromise
    const transaction = database.transaction(
      REVIEW_STATES_STORE,
      'readwrite',
    )
    const store = transaction.objectStore(REVIEW_STATES_STORE)
    const existing = await store
      .index(REVIEW_STATE_TARGET_INDEX)
      .get([input.target_type, input.target_id])
    const stored: StoredReviewState = {
      review_state_id:
        existing?.review_state_id ?? input.review_state_id,
      learner_ref: input.learner_ref,
      target_type: input.target_type,
      target_id: input.target_id,
      learning_status: input.learning_status,
      last_reviewed_at: input.last_reviewed_at ?? now(),
      review_count: (existing?.review_count ?? 0) + 1,
    }

    await store.put(stored)
    await transaction.done
    return stored
  }

  async function listPersonalCorrections(): Promise<
    StoredPersonalCorrection[]
  > {
    const database = await databasePromise
    const corrections = await database.getAll(CORRECTIONS_STORE)
    return corrections.sort((left, right) =>
      compareIdentifiers(left.correction_id, right.correction_id),
    )
  }

  async function deletePersonalCorrectionsForUserAnswer(
    userAnswerId: string,
  ): Promise<void> {
    const database = await databasePromise
    const transaction = database.transaction(
      CORRECTIONS_STORE,
      'readwrite',
    )
    await deleteCorrectionsInTransaction(
      transaction.objectStore(CORRECTIONS_STORE),
      userAnswerId,
    )
    await transaction.done
  }

  async function getPracticeDraftByQuestionId(
    questionId: string,
  ): Promise<StoredPracticeDraft | undefined> {
    return getPracticeDraftByTarget('question', questionId)
  }

  async function getPracticeDraftByTarget(
    targetType: LearningTargetType,
    targetId: string,
  ): Promise<StoredPracticeDraft | undefined> {
    const database = await databasePromise
    return database.getFromIndex(
      PRACTICE_DRAFTS_STORE,
      PRACTICE_DRAFT_TARGET_INDEX,
      [targetType, targetId],
    )
  }

  async function listPracticeDrafts(): Promise<StoredPracticeDraft[]> {
    const database = await databasePromise
    const drafts = await database.getAll(PRACTICE_DRAFTS_STORE)
    return drafts.sort((left, right) => {
      const typeOrder = compareIdentifiers(
        left.target_type ?? 'question',
        right.target_type ?? 'question',
      )
      return typeOrder === 0
        ? compareIdentifiers(
            left.target_id ?? left.question_id,
            right.target_id ?? right.question_id,
          )
        : typeOrder
    })
  }

  async function upsertPracticeDraft(
    input: PracticeDraftInput,
  ): Promise<StoredPracticeDraft> {
    validatePracticeDraft(input)
    const database = await databasePromise
    const transaction = database.transaction(PRACTICE_DRAFTS_STORE, 'readwrite')
    const store = transaction.objectStore(PRACTICE_DRAFTS_STORE)
    const targetType = input.target_type ?? 'question'
    const targetId = input.target_id ?? input.question_id
    const existing = await store
      .index(PRACTICE_DRAFT_TARGET_INDEX)
      .get([targetType, targetId])
    const timestamp = now()
    const stored: StoredPracticeDraft = {
      practice_draft_id:
        existing?.practice_draft_id ?? input.practice_draft_id,
      learner_ref: input.learner_ref,
      question_id: input.question_id,
      target_type: targetType,
      target_id: targetId,
      input_language: input.input_language,
      original_input: input.original_input,
      planning_keywords: input.planning_keywords
        ? structuredClone(input.planning_keywords)
        : existing?.planning_keywords,
      structured_answer: input.structured_answer
        ? structuredClone(input.structured_answer)
        : existing?.structured_answer,
      full_text: input.full_text ?? existing?.full_text,
      completion_status:
        input.completion_status ?? existing?.completion_status,
      completed_at: input.completed_at ?? existing?.completed_at,
      understanding_confirmed:
        input.understanding_confirmed ?? existing?.understanding_confirmed,
      skipped_sections: input.skipped_sections
        ? [...input.skipped_sections]
        : existing?.skipped_sections,
      story_keywords: input.story_keywords
        ? [...input.story_keywords]
        : existing?.story_keywords,
      story_points: input.story_points
        ? structuredClone(input.story_points)
        : existing?.story_points,
      draft_status: 'draft',
      created_at: existing?.created_at ?? input.created_at ?? timestamp,
      updated_at: timestamp,
    }
    await store.put(stored)
    await transaction.done
    return stored
  }

  async function deletePracticeDraft(practiceDraftId: string): Promise<void> {
    const database = await databasePromise
    await database.delete(PRACTICE_DRAFTS_STORE, practiceDraftId)
  }

  async function listReusablePhrases(): Promise<StoredReusablePhrase[]> {
    const database = await databasePromise
    return (await database.getAll(REUSABLE_PHRASES_STORE)).sort((left, right) =>
      compareIdentifiers(left.reusable_phrase_id, right.reusable_phrase_id),
    )
  }

  async function upsertReusablePhrase(
    input: ReusablePhraseInput,
  ): Promise<StoredReusablePhrase> {
    if (!input.reusable_phrase_id.trim() || !input.text.trim()) {
      throw new Error('재사용 표현 ID와 원문은 필수입니다')
    }
    const database = await databasePromise
    const existing = await database.get(
      REUSABLE_PHRASES_STORE,
      input.reusable_phrase_id,
    )
    const timestamp = now()
    const stored: StoredReusablePhrase = {
      ...input,
      text: input.text,
      source_kind: 'user_created',
      source_target_type: input.source_target_type ?? 'question',
      source_target_id:
        input.source_target_id ?? input.source_question_id,
      created_at: existing?.created_at ?? input.created_at ?? timestamp,
      updated_at: timestamp,
    }
    await database.put(REUSABLE_PHRASES_STORE, stored)
    return stored
  }

  async function deleteReusablePhrase(reusablePhraseId: string): Promise<void> {
    const database = await databasePromise
    await database.delete(REUSABLE_PHRASES_STORE, reusablePhraseId)
  }

  async function listRecallAttemptsByQuestionId(
    questionId: string,
  ): Promise<StoredRecallAttempt[]> {
    return listRecallAttemptsByTarget('question', questionId)
  }

  async function listRecallAttemptsByTarget(
    targetType: LearningTargetType,
    targetId: string,
  ): Promise<StoredRecallAttempt[]> {
    const database = await databasePromise
    return database.getAllFromIndex(
      RECALL_ATTEMPTS_STORE,
      RECALL_ATTEMPT_TARGET_INDEX,
      [targetType, targetId],
    )
  }

  async function listRecallAttempts(): Promise<StoredRecallAttempt[]> {
    const database = await databasePromise
    return database.getAll(RECALL_ATTEMPTS_STORE)
  }

  async function addRecallAttempt(
    input: RecallAttemptInput,
  ): Promise<StoredRecallAttempt> {
    const targetType = input.target_type ?? 'question'
    const targetId = input.target_id ?? input.question_id
    if (!input.recall_attempt_id.trim() || !targetId.trim()) {
      throw new Error('회상 기록 ID와 target_id는 필수입니다')
    }
    const hasExplicitTarget = Boolean(
      input.target_type && input.target_id?.trim(),
    )
    if (!input.practice_draft_id && !input.user_answer_id && !hasExplicitTarget) {
      throw new Error(
        '회상 기록은 연습 초안, 교정 답변 또는 명시적 학습 대상을 참조해야 합니다',
      )
    }
    const database = await databasePromise
    const stored: StoredRecallAttempt = {
      ...input,
      target_type: targetType,
      target_id: targetId,
      attempted_at: input.attempted_at ?? now(),
    }
    await database.put(RECALL_ATTEMPTS_STORE, stored)
    return stored
  }

  async function close(): Promise<void> {
    const database = await databasePromise
    database.close()
  }

  async function destroy(): Promise<void> {
    await close()
    await deleteTscStudyUserDatabase(databaseName)
  }

  return {
    getUserAnswerByQuestionId,
    listUserAnswers,
    upsertUserAnswer,
    saveApprovedAnswer,
    deleteUserAnswer,
    getReviewState,
    listReviewStates,
    upsertReviewState,
    listPersonalCorrections,
    deletePersonalCorrectionsForUserAnswer,
    getPracticeDraftByQuestionId,
    getPracticeDraftByTarget,
    listPracticeDrafts,
    upsertPracticeDraft,
    deletePracticeDraft,
    listReusablePhrases,
    upsertReusablePhrase,
    deleteReusablePhrase,
    listRecallAttemptsByQuestionId,
    listRecallAttemptsByTarget,
    listRecallAttempts,
    addRecallAttempt,
    close,
    destroy,
  }
}

export type { TscStudyUserDataSchema }
