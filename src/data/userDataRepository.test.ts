import { afterEach, describe, expect, it } from 'vitest'

import {
  createUserDataRepository,
  type PersonalCorrectionInput,
  type ReviewStateInput,
  type UserAnswerInput,
} from './userDataRepository'

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
