import { afterEach, describe, expect, it } from 'vitest'
import { openDB } from 'idb'

import {
  createUserDataRepository,
  type PersonalCorrectionInput,
  type PracticeDraftInput,
  type ReviewStateInput,
  type UserAnswerInput,
} from './userDataRepository'
import {
  CORRECTIONS_STORE,
  CORRECTION_USER_ANSWER_INDEX,
  PRACTICE_DRAFTS_STORE,
  RECALL_ATTEMPTS_STORE,
  REUSABLE_PHRASES_STORE,
  REVIEW_STATES_STORE,
  REVIEW_STATE_TARGET_ID_INDEX,
  REVIEW_STATE_TARGET_INDEX,
  USER_ANSWERS_STORE,
  USER_ANSWER_QUESTION_INDEX,
  USER_DATA_DB_VERSION,
} from './indexedDb'

const openedRepositories: Array<ReturnType<typeof createUserDataRepository>> = []
let databaseSequence = 0

function createRepository(nowValues = ['2026-07-26T10:00:00.000Z']) {
  const databaseName = `tsc-study-user-data-test-${databaseSequence++}`
  let nowIndex = 0
  const repository = createUserDataRepository({
    databaseName,
    now: () => nowValues[Math.min(nowIndex++, nowValues.length - 1)],
  })

  openedRepositories.push(repository)
  return repository
}

function makeUserAnswer(
  overrides: Partial<UserAnswerInput> = {},
): UserAnswerInput {
  return {
    user_answer_id: 'ua-P4-006',
    question_id: 'P4-006',
    input_language: 'zh',
    original_input:
      '我喜欢在家运动。工作很忙，没有时间去健身房。在家看视频运动很方便。',
    corrected_zh:
      '我喜欢在家运动。因为工作很忙，我没有时间去健身房。在家一边看视频一边运动很方便。',
    corrected_pinyin:
      'Wǒ xǐhuan zài jiā yùndòng. Yīnwèi gōngzuò hěn máng, wǒ méiyǒu shíjiān qù jiànshēnfáng. Zài jiā yìbiān kàn shìpín yìbiān yùndòng hěn fāngbiàn.',
    corrected_ko:
      '저는 집에서 운동하는 것을 좋아합니다. 일이 매우 바빠서 저는 헬스장에 갈 시간이 없습니다. 집에서 영상을 보면서 운동하는 것은 매우 편리합니다.',
    correction_mode: 'minimal',
    change_summary: [
      {
        before: '工作很忙，没有时间去健身房。',
        after: '因为工作很忙，我没有时间去健身房。',
        reason: '이유 관계와 주어를 명확히 했다.',
      },
    ],
    structure_segments: [],
    save_status: 'user_approved',
    ...overrides,
  }
}

function makeCorrection(
  overrides: Partial<PersonalCorrectionInput> = {},
): PersonalCorrectionInput {
  return {
    correction_id: 'c-ua-P4-006-001',
    wrong_zh: '工作很忙，没有时间去健身房。',
    correct_zh: '因为工作很忙，我没有时间去健身房。',
    error_type: '내용 연결',
    reason: '이유 관계와 주어를 명확히 했다.',
    source_kind: 'user_answer',
    data_scope: 'personal',
    correction_status: 'review_needed',
    ...overrides,
  }
}

function makeReviewState(
  overrides: Partial<ReviewStateInput> = {},
): ReviewStateInput {
  return {
    review_state_id: 'rs-question-P4-006',
    target_type: 'question',
    target_id: 'P4-006',
    learning_status: '못 외움',
    ...overrides,
  }
}

function makePracticeDraft(
  overrides: Partial<PracticeDraftInput> = {},
): PracticeDraftInput {
  return {
    practice_draft_id: 'pd-P4-001',
    question_id: 'P4-001',
    input_language: 'mixed',
    original_input: '저는 친구와 一起旅行하고 싶어요.',
    draft_status: 'draft',
    ...overrides,
  }
}

afterEach(async () => {
  await Promise.all(
    openedRepositories.splice(0).map(async (repository) => {
      await repository.destroy()
    }),
  )
})

describe('UserDataRepository UserAnswer', () => {
  it('stores, reads, lists, and updates one stable active answer per question', async () => {
    const repository = createRepository([
      '2026-07-26T10:00:00.000Z',
      '2026-07-26T11:00:00.000Z',
    ])

    const created = await repository.upsertUserAnswer(makeUserAnswer())

    expect(created.user_answer_id).toBe('ua-P4-006')
    expect(created.created_at).toBe('2026-07-26T10:00:00.000Z')
    expect(created.updated_at).toBe('2026-07-26T10:00:00.000Z')
    await expect(repository.getUserAnswerByQuestionId('P4-006')).resolves.toEqual(
      created,
    )

    const updated = await repository.upsertUserAnswer(
      makeUserAnswer({
        user_answer_id: 'ua-replacement-must-not-win',
        corrected_ko: '수정된 한국어 뜻',
      }),
    )

    expect(updated.user_answer_id).toBe('ua-P4-006')
    expect(updated.created_at).toBe('2026-07-26T10:00:00.000Z')
    expect(updated.updated_at).toBe('2026-07-26T11:00:00.000Z')
    expect(updated.corrected_ko).toBe('수정된 한국어 뜻')
    await expect(repository.listUserAnswers()).resolves.toEqual([updated])
  })

  it('deletes an answer and cascades its personal corrections', async () => {
    const repository = createRepository()

    await repository.saveApprovedAnswer(makeUserAnswer(), [makeCorrection()])
    await repository.deleteUserAnswer('ua-P4-006')

    await expect(
      repository.getUserAnswerByQuestionId('P4-006'),
    ).resolves.toBeUndefined()
    await expect(repository.listPersonalCorrections()).resolves.toEqual([])
  })
})

describe('UserDataRepository ReviewState', () => {
  it('creates no implicit state and increments review count only on explicit updates', async () => {
    const repository = createRepository([
      '2026-07-26T10:00:00.000Z',
      '2026-07-26T11:00:00.000Z',
    ])

    await expect(
      repository.getReviewState('question', 'P4-006'),
    ).resolves.toBeUndefined()
    await expect(repository.listReviewStates()).resolves.toEqual([])

    const created = await repository.upsertReviewState(makeReviewState())
    expect(created.learning_status).toBe('못 외움')
    expect(created.review_count).toBe(1)
    expect(created.last_reviewed_at).toBe('2026-07-26T10:00:00.000Z')

    const updated = await repository.upsertReviewState(
      makeReviewState({
        review_state_id: 'rs-replacement-must-not-win',
        learning_status: '외움',
      }),
    )
    expect(updated.review_state_id).toBe('rs-question-P4-006')
    expect(updated.learning_status).toBe('외움')
    expect(updated.review_count).toBe(2)
    expect(updated.last_reviewed_at).toBe('2026-07-26T11:00:00.000Z')
    await expect(repository.listReviewStates()).resolves.toEqual([updated])
  })
})

describe('UserDataRepository personal Correction', () => {
  it('atomically stores approved answers and only actual personal changes', async () => {
    const repository = createRepository()
    const unchanged = makeCorrection({
      correction_id: 'c-unchanged',
      wrong_zh: '我喜欢在家运动。',
      correct_zh: '我喜欢在家运动。',
    })

    await repository.saveApprovedAnswer(makeUserAnswer(), [
      makeCorrection(),
      unchanged,
    ])

    const corrections = await repository.listPersonalCorrections()
    expect(corrections).toHaveLength(1)
    expect(corrections[0]).toMatchObject({
      correction_id: 'c-ua-P4-006-001',
      user_answer_id: 'ua-P4-006',
      data_scope: 'personal',
      source_kind: 'user_answer',
      created_at: '2026-07-26T10:00:00.000Z',
    })
    expect(corrections[0]).not.toHaveProperty('learning_status')

    await repository.deletePersonalCorrectionsForUserAnswer('ua-P4-006')
    await expect(repository.listPersonalCorrections()).resolves.toEqual([])
  })

  it('replaces prior corrections when the approved answer is saved again', async () => {
    const repository = createRepository([
      '2026-07-26T10:00:00.000Z',
      '2026-07-26T11:00:00.000Z',
    ])

    await repository.saveApprovedAnswer(makeUserAnswer(), [makeCorrection()])
    await repository.saveApprovedAnswer(makeUserAnswer(), [
      makeCorrection({
        correction_id: 'c-ua-P4-006-002',
        wrong_zh: '在家看视频运动很方便。',
        correct_zh: '在家一边看视频一边运动很方便。',
      }),
    ])

    const corrections = await repository.listPersonalCorrections()
    expect(corrections.map(({ correction_id }) => correction_id)).toEqual([
      'c-ua-P4-006-002',
    ])
  })
})

describe('UserDataRepository namespace isolation', () => {
  it('keeps records in different IndexedDB names isolated', async () => {
    const first = createRepository()
    const second = createRepository()

    await first.upsertUserAnswer(makeUserAnswer())

    await expect(first.listUserAnswers()).resolves.toHaveLength(1)
    await expect(second.listUserAnswers()).resolves.toEqual([])
  })
})

describe('UserDataRepository PracticeDraft', () => {
  it('stores, restores, and upserts one active draft per Question', async () => {
    const repository = createRepository([
      '2026-07-26T10:00:00.000Z',
      '2026-07-26T11:00:00.000Z',
    ])

    const created = await repository.upsertPracticeDraft(makePracticeDraft())
    expect(created.created_at).toBe('2026-07-26T10:00:00.000Z')
    expect(created.updated_at).toBe('2026-07-26T10:00:00.000Z')
    await expect(repository.getPracticeDraftByQuestionId('P4-001')).resolves.toEqual(
      created,
    )

    const updated = await repository.upsertPracticeDraft(
      makePracticeDraft({
        practice_draft_id: 'pd-replacement-must-not-win',
        original_input: '수정한 연습 초안',
        input_language: 'ko',
      }),
    )
    expect(updated.practice_draft_id).toBe('pd-P4-001')
    expect(updated.original_input).toBe('수정한 연습 초안')
    expect(updated.created_at).toBe('2026-07-26T10:00:00.000Z')
    expect(updated.updated_at).toBe('2026-07-26T11:00:00.000Z')
    await expect(repository.listPracticeDrafts()).resolves.toEqual([updated])
  })

  it('rejects blank drafts and deletes only the explicit draft', async () => {
    const repository = createRepository()

    await expect(
      repository.upsertPracticeDraft(
        makePracticeDraft({ original_input: '   ' }),
      ),
    ).rejects.toThrow(/빈|original_input|required/)

    await repository.upsertPracticeDraft(makePracticeDraft())
    await repository.deletePracticeDraft('pd-P4-001')
    await expect(repository.listPracticeDrafts()).resolves.toEqual([])
  })
})

describe('UserDataRepository structured learning records', () => {
  it('persists additive structured draft fields and one explicitly saved reusable phrase', async () => {
    const repository = createRepository()
    const draft = await repository.upsertPracticeDraft(
      makePracticeDraft({
        planning_keywords: {
          direct_answer: ['집 운동'],
          reasons: ['편리함', '시간 절약'],
          example: [],
          conclusion: [],
        },
        structured_answer: {
          direct_answer: '我喜欢在家运动。',
          reasons: '在家运动很方便。',
          example: '',
          conclusion: '',
        },
        full_text: '我喜欢在家运动。\n在家运动很方便。',
        completion_status: 'completed',
        completed_at: '2026-07-26T09:00:00.000Z',
      }),
    )
    expect(draft.structured_answer?.reasons).toBe('在家运动很方便。')

    await repository.upsertReusablePhrase({
      reusable_phrase_id: 'rp-P4-001-001',
      text: '在家运动很方便。',
      language: 'zh',
      phrase_type: 'reason',
      source_kind: 'user_created',
      source_question_id: 'P4-001',
    })
    await expect(repository.listReusablePhrases()).resolves.toMatchObject([
      { text: '在家运动很方便。', source_kind: 'user_created' },
    ])
    await repository.deleteReusablePhrase('rp-P4-001-001')
    await expect(repository.listReusablePhrases()).resolves.toEqual([])
  })

  it('stores every explicit recall attempt without inventing review timing', async () => {
    const repository = createRepository()
    await repository.addRecallAttempt({
      recall_attempt_id: 'ra-P4-001-001',
      question_id: 'P4-001',
      practice_draft_id: 'pd-P4-001',
      recall_mode: 'keywords_only',
      result: 'used_keywords',
    })
    await expect(repository.listRecallAttemptsByQuestionId('P4-001')).resolves.toMatchObject([
      {
        recall_mode: 'keywords_only',
        result: 'used_keywords',
        attempted_at: '2026-07-26T10:00:00.000Z',
      },
    ])
  })
})

describe('IndexedDB v2 to v3 migration', () => {
  it('adds structured learning stores without deleting existing v2 personal records', async () => {
    const databaseName = `tsc-study-user-data-migration-${databaseSequence++}`
    const legacy = await openDB(databaseName, 2, {
      upgrade(database) {
        const userAnswers = database.createObjectStore(USER_ANSWERS_STORE, {
          keyPath: 'user_answer_id',
        })
        userAnswers.createIndex(USER_ANSWER_QUESTION_INDEX, 'question_id', {
          unique: true,
        })
        const reviewStates = database.createObjectStore(REVIEW_STATES_STORE, {
          keyPath: 'review_state_id',
        })
        reviewStates.createIndex(
          REVIEW_STATE_TARGET_INDEX,
          ['target_type', 'target_id'],
          { unique: true },
        )
        reviewStates.createIndex(REVIEW_STATE_TARGET_ID_INDEX, 'target_id')
        const corrections = database.createObjectStore(CORRECTIONS_STORE, {
          keyPath: 'correction_id',
        })
        corrections.createIndex(
          CORRECTION_USER_ANSWER_INDEX,
          'user_answer_id',
        )
        const practiceDrafts = database.createObjectStore(
          PRACTICE_DRAFTS_STORE,
          { keyPath: 'practice_draft_id' },
        )
        practiceDrafts.createIndex('by-question-id', 'question_id', {
          unique: true,
        })
      },
    })
    const legacyAnswer = {
      ...makeUserAnswer({ created_at: '2026-07-26T09:00:00.000Z' }),
      updated_at: '2026-07-26T09:00:00.000Z',
    }
    const legacyReview = {
      ...makeReviewState({ last_reviewed_at: '2026-07-26T09:00:00.000Z' }),
      review_count: 1,
    }
    const legacyCorrection = {
      ...makeCorrection({ user_answer_id: 'ua-P4-006' }),
      user_answer_id: 'ua-P4-006',
      created_at: '2026-07-26T09:00:00.000Z',
    }
    await legacy.put(USER_ANSWERS_STORE, legacyAnswer)
    await legacy.put(REVIEW_STATES_STORE, legacyReview)
    await legacy.put(CORRECTIONS_STORE, legacyCorrection)
    const legacyDraft = {
      ...makePracticeDraft(),
      created_at: '2026-07-26T09:00:00.000Z',
      updated_at: '2026-07-26T09:00:00.000Z',
    }
    await legacy.put(PRACTICE_DRAFTS_STORE, legacyDraft)
    legacy.close()

    const repository = createUserDataRepository({ databaseName })
    openedRepositories.push(repository)

    await expect(repository.listUserAnswers()).resolves.toEqual([legacyAnswer])
    await expect(repository.listReviewStates()).resolves.toEqual([legacyReview])
    await expect(repository.listPersonalCorrections()).resolves.toEqual([
      legacyCorrection,
    ])
    await expect(repository.listPracticeDrafts()).resolves.toEqual([legacyDraft])

    const migrated = await openDB(databaseName, USER_DATA_DB_VERSION)
    expect([...migrated.objectStoreNames]).toContain(PRACTICE_DRAFTS_STORE)
    expect([...migrated.objectStoreNames]).toContain(REUSABLE_PHRASES_STORE)
    expect([...migrated.objectStoreNames]).toContain(RECALL_ATTEMPTS_STORE)
    migrated.close()
  })
})
