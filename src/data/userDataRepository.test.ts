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
  PRACTICE_DRAFT_QUESTION_INDEX,
  PRACTICE_DRAFT_TARGET_INDEX,
  RECALL_ATTEMPTS_STORE,
  RECALL_ATTEMPT_TARGET_INDEX,
  REUSABLE_PHRASE_TARGET_INDEX,
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

  it('stores an exam self-assessment against an explicit target without inventing a draft', async () => {
    const repository = createRepository()
    await repository.addRecallAttempt({
      recall_attempt_id: 'ra-exam-vq-P2-V01-Q1-001',
      question_id: 'vq-P2-V01-Q1',
      target_type: 'visual_question',
      target_id: 'vq-P2-V01-Q1',
      recall_mode: 'visual_question',
      result: 'used_keywords',
    })

    const attempts = await repository.listRecallAttemptsByTarget(
      'visual_question',
      'vq-P2-V01-Q1',
    )
    expect(attempts).toMatchObject([
      {
        target_type: 'visual_question',
        result: 'used_keywords',
      },
    ])
    expect(attempts[0]).not.toHaveProperty('practice_draft_id')
  })

  it('stores visual-question drafts, phrases, recall attempts, and review state by explicit target', async () => {
    const repository = createRepository()
    const targetId = 'vq-P2-V01-Q1'

    const draft = await repository.upsertPracticeDraft({
      practice_draft_id: `pd-${targetId}`,
      question_id: targetId,
      target_type: 'visual_question',
      target_id: targetId,
      input_language: 'zh',
      original_input: '她在看书。',
      full_text: '她在看书。',
      completion_status: 'completed',
      draft_status: 'draft',
    })
    await expect(
      repository.getPracticeDraftByTarget('visual_question', targetId),
    ).resolves.toEqual(draft)

    await repository.upsertReusablePhrase({
      reusable_phrase_id: `rp-${targetId}-001`,
      text: '她在看书。',
      language: 'zh',
      phrase_type: 'other',
      source_kind: 'user_created',
      source_question_id: targetId,
      source_target_type: 'visual_question',
      source_target_id: targetId,
    })
    await expect(repository.listReusablePhrases()).resolves.toEqual([
      expect.objectContaining({
        source_target_type: 'visual_question',
        source_target_id: targetId,
      }),
    ])

    await repository.addRecallAttempt({
      recall_attempt_id: `ra-${targetId}-001`,
      question_id: targetId,
      target_type: 'visual_question',
      target_id: targetId,
      practice_draft_id: draft.practice_draft_id,
      recall_mode: 'visual_only',
      result: 'used_keywords',
    })
    await expect(
      repository.listRecallAttemptsByTarget('visual_question', targetId),
    ).resolves.toHaveLength(1)

    await repository.upsertReviewState({
      review_state_id: `rs-visual-question-${targetId}`,
      target_type: 'visual_question',
      target_id: targetId,
      learning_status: '헷갈림',
    })
    await expect(
      repository.getReviewState('visual_question', targetId),
    ).resolves.toMatchObject({ learning_status: '헷갈림' })
  })

  it('stores a learner-authored Part 7 story against a VisualSet target', async () => {
    const repository = createRepository()
    const targetId = 'vs-P7-V01'
    const draft = await repository.upsertPracticeDraft({
      practice_draft_id: `pd-${targetId}`,
      question_id: targetId,
      target_type: 'visual_set',
      target_id: targetId,
      input_language: 'mixed',
      original_input: '친구를 만나서 같이 공원에 갔다.',
      story_keywords: ['친구', '공원'],
      story_points: [
        { point_id: 'sp-v01-001', text: '친구를 만난다', order: 1 },
        { point_id: 'sp-v01-002', text: '공원에 간다', order: 2 },
      ],
      full_text: '친구를 만나서 같이 공원에 갔다.',
      completion_status: 'completed',
      draft_status: 'draft',
    })
    await expect(
      repository.getPracticeDraftByTarget('visual_set', targetId),
    ).resolves.toEqual(draft)
    expect(draft.story_keywords).toEqual(['친구', '공원'])
    expect(draft.story_points?.map((point) => point.order)).toEqual([1, 2])

    await repository.upsertReusablePhrase({
      reusable_phrase_id: `rp-${targetId}-001`,
      text: '친구를 만난다',
      language: 'ko',
      phrase_type: 'other',
      source_kind: 'user_created',
      source_question_id: targetId,
      source_target_type: 'visual_set',
      source_target_id: targetId,
    })
    await repository.addRecallAttempt({
      recall_attempt_id: `ra-${targetId}-001`,
      question_id: targetId,
      target_type: 'visual_set',
      target_id: targetId,
      practice_draft_id: draft.practice_draft_id,
      recall_mode: 'story_points_only',
      result: 'used_keywords',
    })
    await repository.upsertReviewState({
      review_state_id: `rs-visual-set-${targetId}`,
      target_type: 'visual_set',
      target_id: targetId,
      learning_status: '헷갈림',
    })

    await expect(
      repository.listRecallAttemptsByTarget('visual_set', targetId),
    ).resolves.toMatchObject([{ recall_mode: 'story_points_only' }])
    await expect(
      repository.getReviewState('visual_set', targetId),
    ).resolves.toMatchObject({ learning_status: '헷갈림' })
  })
})

describe('IndexedDB v4 to v5 migration', () => {
  it('adds VisualSet target support without deleting any existing v4 record', async () => {
    const databaseName = `tsc-study-user-data-v5-migration-${databaseSequence++}`
    const legacy = await openDB(databaseName, 4, {
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
        corrections.createIndex(CORRECTION_USER_ANSWER_INDEX, 'user_answer_id')
        const drafts = database.createObjectStore(PRACTICE_DRAFTS_STORE, {
          keyPath: 'practice_draft_id',
        })
        drafts.createIndex(PRACTICE_DRAFT_QUESTION_INDEX, 'question_id', {
          unique: true,
        })
        drafts.createIndex(
          PRACTICE_DRAFT_TARGET_INDEX,
          ['target_type', 'target_id'],
          { unique: true },
        )
        const phrases = database.createObjectStore(REUSABLE_PHRASES_STORE, {
          keyPath: 'reusable_phrase_id',
        })
        phrases.createIndex('by-question-id', 'source_question_id')
        phrases.createIndex(
          REUSABLE_PHRASE_TARGET_INDEX,
          ['source_target_type', 'source_target_id'],
        )
        const attempts = database.createObjectStore(RECALL_ATTEMPTS_STORE, {
          keyPath: 'recall_attempt_id',
        })
        attempts.createIndex('by-question-id', 'question_id')
        attempts.createIndex(
          RECALL_ATTEMPT_TARGET_INDEX,
          ['target_type', 'target_id'],
        )
      },
    })
    await legacy.put(PRACTICE_DRAFTS_STORE, {
      ...makePracticeDraft(),
      target_type: 'question',
      target_id: 'P4-001',
      created_at: '2026-07-30T09:00:00.000Z',
      updated_at: '2026-07-30T09:00:00.000Z',
    })
    await legacy.put(REUSABLE_PHRASES_STORE, {
      reusable_phrase_id: 'rp-v4-001',
      text: '他在跑步。',
      language: 'zh',
      phrase_type: 'other',
      source_kind: 'user_created',
      source_question_id: 'vq-P2-V01-Q1',
      source_target_type: 'visual_question',
      source_target_id: 'vq-P2-V01-Q1',
      created_at: '2026-07-30T09:00:00.000Z',
      updated_at: '2026-07-30T09:00:00.000Z',
    })
    await legacy.put(RECALL_ATTEMPTS_STORE, {
      recall_attempt_id: 'ra-v4-001',
      question_id: 'vq-P2-V01-Q1',
      target_type: 'visual_question',
      target_id: 'vq-P2-V01-Q1',
      practice_draft_id: 'pd-v4-001',
      recall_mode: 'visual_only',
      result: 'almost',
      attempted_at: '2026-07-30T09:00:00.000Z',
    })
    await legacy.put(USER_ANSWERS_STORE, {
      ...makeUserAnswer({ created_at: '2026-07-30T09:00:00.000Z' }),
      updated_at: '2026-07-30T09:00:00.000Z',
    })
    await legacy.put(REVIEW_STATES_STORE, {
      ...makeReviewState({ last_reviewed_at: '2026-07-30T09:00:00.000Z' }),
      review_count: 1,
    })
    await legacy.put(CORRECTIONS_STORE, {
      ...makeCorrection({ user_answer_id: 'ua-P4-006' }),
      user_answer_id: 'ua-P4-006',
      created_at: '2026-07-30T09:00:00.000Z',
    })
    legacy.close()

    const repository = createUserDataRepository({ databaseName })
    openedRepositories.push(repository)

    await expect(repository.listPracticeDrafts()).resolves.toHaveLength(1)
    await expect(repository.listReusablePhrases()).resolves.toHaveLength(1)
    await expect(repository.listRecallAttempts()).resolves.toHaveLength(1)
    await expect(repository.listUserAnswers()).resolves.toHaveLength(1)
    await expect(repository.listReviewStates()).resolves.toHaveLength(1)
    await expect(repository.listPersonalCorrections()).resolves.toHaveLength(1)
    await repository.upsertPracticeDraft({
      practice_draft_id: 'pd-vs-P7-V01',
      question_id: 'vs-P7-V01',
      target_type: 'visual_set',
      target_id: 'vs-P7-V01',
      input_language: 'ko',
      original_input: '내 이야기',
      story_keywords: ['이야기'],
      story_points: [{ point_id: 'sp-001', text: '시작', order: 1 }],
      draft_status: 'draft',
    })
    await expect(
      repository.getPracticeDraftByTarget('visual_set', 'vs-P7-V01'),
    ).resolves.toMatchObject({ story_keywords: ['이야기'] })

    const migrated = await openDB(databaseName, USER_DATA_DB_VERSION)
    expect(migrated.version).toBe(5)
    migrated.close()
  })
})

describe('IndexedDB v3 to v4 migration', () => {
  it('adds target indexes and preserves every existing learning record', async () => {
    const databaseName = `tsc-study-user-data-target-migration-${databaseSequence++}`
    const legacy = await openDB(databaseName, 3, {
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
        const drafts = database.createObjectStore(PRACTICE_DRAFTS_STORE, {
          keyPath: 'practice_draft_id',
        })
        drafts.createIndex(PRACTICE_DRAFT_QUESTION_INDEX, 'question_id', {
          unique: true,
        })
        const phrases = database.createObjectStore(REUSABLE_PHRASES_STORE, {
          keyPath: 'reusable_phrase_id',
        })
        phrases.createIndex('by-question-id', 'source_question_id')
        const attempts = database.createObjectStore(RECALL_ATTEMPTS_STORE, {
          keyPath: 'recall_attempt_id',
        })
        attempts.createIndex('by-question-id', 'question_id')
      },
    })
    const draft = {
      ...makePracticeDraft(),
      created_at: '2026-07-26T09:00:00.000Z',
      updated_at: '2026-07-26T09:00:00.000Z',
    }
    const phrase = {
      reusable_phrase_id: 'rp-P4-001-001',
      text: '在家运动。',
      language: 'zh',
      phrase_type: 'other',
      source_kind: 'user_created',
      source_question_id: 'P4-001',
      created_at: '2026-07-26T09:00:00.000Z',
      updated_at: '2026-07-26T09:00:00.000Z',
    }
    const attempt = {
      recall_attempt_id: 'ra-P4-001-001',
      question_id: 'P4-001',
      practice_draft_id: 'pd-P4-001',
      recall_mode: 'question_only',
      result: 'almost',
      attempted_at: '2026-07-26T09:00:00.000Z',
    }
    const answer = {
      ...makeUserAnswer({ created_at: '2026-07-26T09:00:00.000Z' }),
      updated_at: '2026-07-26T09:00:00.000Z',
    }
    const review = {
      ...makeReviewState({ last_reviewed_at: '2026-07-26T09:00:00.000Z' }),
      review_count: 1,
    }
    const correction = {
      ...makeCorrection({ user_answer_id: 'ua-P4-006' }),
      user_answer_id: 'ua-P4-006',
      created_at: '2026-07-26T09:00:00.000Z',
    }
    await legacy.put(PRACTICE_DRAFTS_STORE, draft)
    await legacy.put(REUSABLE_PHRASES_STORE, phrase)
    await legacy.put(RECALL_ATTEMPTS_STORE, attempt)
    await legacy.put(USER_ANSWERS_STORE, answer)
    await legacy.put(REVIEW_STATES_STORE, review)
    await legacy.put(CORRECTIONS_STORE, correction)
    legacy.close()

    const repository = createUserDataRepository({ databaseName })
    openedRepositories.push(repository)

    await expect(
      repository.getPracticeDraftByTarget('question', 'P4-001'),
    ).resolves.toMatchObject({
      practice_draft_id: 'pd-P4-001',
      target_type: 'question',
      target_id: 'P4-001',
    })
    await expect(repository.listReusablePhrases()).resolves.toEqual([
      expect.objectContaining({
        reusable_phrase_id: 'rp-P4-001-001',
        source_target_type: 'question',
        source_target_id: 'P4-001',
      }),
    ])
    await expect(
      repository.listRecallAttemptsByTarget('question', 'P4-001'),
    ).resolves.toEqual([
      expect.objectContaining({
        recall_attempt_id: 'ra-P4-001-001',
        target_type: 'question',
        target_id: 'P4-001',
      }),
    ])
    await expect(repository.listUserAnswers()).resolves.toHaveLength(1)
    await expect(repository.listReviewStates()).resolves.toHaveLength(1)
    await expect(repository.listPersonalCorrections()).resolves.toHaveLength(1)

    const migrated = await openDB(databaseName, USER_DATA_DB_VERSION)
    const transaction = migrated.transaction(
      [PRACTICE_DRAFTS_STORE, REUSABLE_PHRASES_STORE, RECALL_ATTEMPTS_STORE],
    )
    expect(
      [...transaction.objectStore(PRACTICE_DRAFTS_STORE).indexNames],
    ).toContain(PRACTICE_DRAFT_TARGET_INDEX)
    expect(
      [...transaction.objectStore(REUSABLE_PHRASES_STORE).indexNames],
    ).toContain(REUSABLE_PHRASE_TARGET_INDEX)
    expect(
      [...transaction.objectStore(RECALL_ATTEMPTS_STORE).indexNames],
    ).toContain(RECALL_ATTEMPT_TARGET_INDEX)
    migrated.close()
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
    await expect(repository.listPracticeDrafts()).resolves.toEqual([
      expect.objectContaining({
        ...legacyDraft,
        target_type: 'question',
        target_id: 'P4-001',
      }),
    ])

    const migrated = await openDB(databaseName, USER_DATA_DB_VERSION)
    expect([...migrated.objectStoreNames]).toContain(PRACTICE_DRAFTS_STORE)
    expect([...migrated.objectStoreNames]).toContain(REUSABLE_PHRASES_STORE)
    expect([...migrated.objectStoreNames]).toContain(RECALL_ATTEMPTS_STORE)
    migrated.close()
  })
})
