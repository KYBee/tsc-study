import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createPublicContentRepository } from '../data/publicContentRepository'
import {
  createUserDataRepository,
  type UserAnswerInput,
  type UserDataRepository,
} from '../data/userDataRepository'
import {
  CORRECTED_EXERCISE_INPUT,
  EXERCISE_INPUT,
  MockCorrectionProvider,
} from '../providers/MockCorrectionProvider'
import type { CorrectionProvider } from '../providers/CorrectionProvider'
import { App } from './App'

const repositories: UserDataRepository[] = []
let databaseSequence = 0

function renderApp(
  path = '/',
  options: {
    correctionProvider?: CorrectionProvider
    userRepository?: UserDataRepository
  } = {},
) {
  const userRepository =
    options.userRepository ?? createTestUserRepository()

  render(
    <App
      initialEntries={[path]}
      dependencies={{
        publicRepository: createPublicContentRepository(),
        userRepository,
        correctionProvider:
          options.correctionProvider ?? new MockCorrectionProvider(),
      }}
    />,
  )

  return { userRepository }
}

function createTestUserRepository() {
  const repository = createUserDataRepository({
    databaseName: `tsc-study-ui-test-${databaseSequence++}`,
    now: () => '2026-07-26T10:00:00.000Z',
  })
  repositories.push(repository)
  return repository
}

function makeSavedAnswer(): UserAnswerInput {
  return {
    user_answer_id: 'ua-P4-006',
    question_id: 'P4-006',
    input_language: 'zh',
    original_input: EXERCISE_INPUT,
    corrected_zh: CORRECTED_EXERCISE_INPUT,
    corrected_pinyin:
      'Wǒ xǐhuan zài jiā yùndòng. Yīnwèi gōngzuò hěn máng, wǒ méiyǒu shíjiān qù jiànshēnfáng. Zài jiā yìbiān kàn shìpín yìbiān yùndòng hěn fāngbiàn.',
    corrected_ko:
      '저는 집에서 운동하는 것을 좋아합니다. 일이 매우 바빠서 저는 헬스장에 갈 시간이 없습니다. 집에서 영상을 보면서 운동하는 것은 매우 편리합니다.',
    correction_mode: 'minimal',
    change_summary: [],
    structure_segments: [],
    save_status: 'user_approved',
  }
}

afterEach(async () => {
  cleanup()
  await Promise.all(repositories.splice(0).map((repository) => repository.destroy()))
  window.sessionStorage.clear()
  window.localStorage.clear()
})

describe('text Parts navigation', () => {
  it('shows Part 1 through 7 and preserves the five text Part links', async () => {
    const user = userEvent.setup()
    renderApp()

    const partList = await screen.findByRole('list', { name: 'Part 목록' })
    expect(within(partList).getAllByText(/^Part [1-7]$/)).toHaveLength(7)
    expect(
      within(partList).getByRole('link', { name: /Part 4.*일상 화제 설명하기/ }),
    ).toHaveAttribute('href', '/parts/4')
    for (const [part, count] of [[1, 4], [3, 84], [4, 50], [5, 36], [6, 19]]) {
      expect(
        within(partList).getByRole('link', {
          name: new RegExp(`Part ${part}.*${count}개`),
        }),
      ).toHaveAttribute('href', `/parts/${part}`)
    }
    expect(
      within(partList).getByRole('link', { name: /Part 2.*12세트.*48문항/ }),
    ).toHaveAttribute('href', '/parts/2')
    expect(
      within(partList).getByRole('link', {
        name: /Part 7.*스토리 구성하기.*12세트/,
      }),
    ).toHaveAttribute('href', '/parts/7')

    await user.click(
      within(partList).getByRole('link', {
        name: /Part 4.*일상 화제 설명하기/,
      }),
    )
    expect(await screen.findByRole('heading', { name: '일상 화제 설명하기' })).toBeInTheDocument()
    expect(document.querySelector('#main-content')).toHaveFocus()
  })

  it('shows all fifty canonical Part 4 questions', async () => {
    renderApp('/parts/4')

    const questionList = await screen.findByRole('list', { name: 'Part 4 문제 목록' })
    const ids = within(questionList)
      .getAllByTestId('question-id')
      .map((element) => element.textContent)

    expect(ids).toEqual(
      Array.from({ length: 50 }, (_, index) =>
        `P4-${String(index + 1).padStart(3, '0')}`,
      ),
    )
  })

  it.each([
    [1, 4],
    [3, 84],
    [5, 36],
    [6, 19],
  ])('shows all Part %s questions through the common list', async (part, count) => {
    renderApp(`/parts/${part}`)

    const questionList = await screen.findByRole('list', {
      name: `Part ${part} 문제 목록`,
    })
    expect(within(questionList).getAllByTestId('question-id')).toHaveLength(count)
    expect(screen.getByText(`현재 결과 ${count}개`)).toBeInTheDocument()
  })

  it('searches and filters the Part 4 list without inventing results', async () => {
    const user = userEvent.setup()
    renderApp('/parts/4')

    await user.type(await screen.findByLabelText('문제 검색'), '어디에서 운동')
    expect(screen.getByText('P4-006')).toBeInTheDocument()
    expect(screen.queryByText('P4-007')).not.toBeInTheDocument()
    expect(screen.getByText('현재 결과 1개')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '필터 초기화' }))
    await user.selectOptions(screen.getByLabelText('유형 필터'), '운동')
    expect(screen.getByText('현재 결과 2개')).toBeInTheDocument()
    expect(screen.getByText('P4-006')).toBeInTheDocument()
    expect(screen.getByText('P4-007')).toBeInTheDocument()
  })

  it('shows a safe error screen for an unknown question ID', async () => {
    renderApp('/questions/P4-NOT-FOUND')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '문제를 찾을 수 없습니다',
    )
    expect(screen.getByRole('link', { name: 'Part 4로 돌아가기' })).toHaveAttribute(
      'href',
      '/parts/4',
    )
  })

  it('shows a development data error when default fixture bootstrap validation fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(
      <App
        initialEntries={['/']}
        dependenciesFactory={() => {
          throw new Error('invalid fixture relationship')
        }}
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('개발 데이터 오류')
    expect(screen.getByText(/fixture를 검증하지 못했습니다/)).toBeInTheDocument()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

describe('question and answer flow', () => {
  it.each([1, 3, 5, 6])(
    'stores and completes a free-input Part %s answer without generating language data',
    async (part) => {
      const user = userEvent.setup()
      const questionId = `P${part}-001`
      const userRepository = createTestUserRepository()
      renderApp(`/questions/${questionId}/answer`, { userRepository })

      const editor = await screen.findByLabelText('내 답변')
      await user.type(editor, `Part ${part}에서 내가 직접 쓴 답변`)
      await user.click(screen.getByRole('button', { name: '연습 초안 저장' }))
      expect(await screen.findByText('연습 초안을 저장했습니다')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '답변 작성 완료' }))
      expect(
        await screen.findByRole('heading', { name: '내가 작성한 연습 답변' }),
      ).toBeInTheDocument()

      await expect(
        userRepository.getPracticeDraftByQuestionId(questionId),
      ).resolves.toMatchObject({
        question_id: questionId,
        original_input: `Part ${part}에서 내가 직접 쓴 답변`,
        completion_status: 'completed',
      })
      await expect(userRepository.listUserAnswers()).resolves.toEqual([])
    },
  )

  it('recalls a saved non-Part-4 draft and maps the explicit result', async () => {
    const user = userEvent.setup()
    const userRepository = createTestUserRepository()
    await userRepository.upsertPracticeDraft({
      practice_draft_id: 'pd-P1-001',
      question_id: 'P1-001',
      input_language: 'ko',
      original_input: '내가 직접 저장한 답변',
      full_text: '내가 직접 저장한 답변',
      completion_status: 'completed',
      draft_status: 'draft',
    })
    renderApp('/questions/P1-001/answer?step=recall', { userRepository })

    await user.click(await screen.findByRole('radio', { name: '질문만 보기' }))
    await user.click(screen.getByRole('button', { name: '답변 보기' }))
    expect(screen.getByText('내가 직접 저장한 답변')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '외워서 말함' }))

    await waitFor(async () => {
      await expect(
        userRepository.getReviewState('question', 'P1-001'),
      ).resolves.toMatchObject({ learning_status: '외움' })
    })
    await expect(
      userRepository.listRecallAttemptsByQuestionId('P1-001'),
    ).resolves.toMatchObject([
      { recall_mode: 'question_only', result: 'memorized' },
    ])
  })

  it('restores a free-input draft after reload and saves only an explicitly chosen reusable phrase', async () => {
    const user = userEvent.setup()
    const userRepository = createTestUserRepository()
    renderApp('/questions/P3-001/answer', { userRepository })

    await user.type(await screen.findByLabelText('내 답변'), '내가 직접 쓴 반응')
    await user.click(screen.getByRole('button', { name: '연습 초안 저장' }))
    await user.click(screen.getByRole('button', { name: '재사용 표현으로 저장' }))
    await expect(userRepository.listReusablePhrases()).resolves.toMatchObject([
      {
        text: '내가 직접 쓴 반응',
        source_kind: 'user_created',
        source_question_id: 'P3-001',
      },
    ])

    cleanup()
    renderApp('/questions/P3-001/answer', { userRepository })
    expect(await screen.findByLabelText('내 답변')).toHaveValue('내가 직접 쓴 반응')
    expect(screen.getByText('내가 저장한 재사용 표현')).toBeInTheDocument()
  })

  it('shows common details and language toggles for another text Part', async () => {
    const user = userEvent.setup()
    renderApp('/questions/P5-001')

    expect(await screen.findByRole('heading', { name: 'Part 5 문제' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '답변 구성 힌트' })).toBeInTheDocument()
    expect(screen.getByText('아직 모범답안 없음')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '병음 숨기기' }))
    expect(screen.getByText('병음이 숨겨져 있습니다')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '한국어 숨기기' }))
    expect(screen.getByText('한국어 뜻이 숨겨져 있습니다')).toBeInTheDocument()
  })

  it('filters My Answers drafts by Part without losing either record', async () => {
    const user = userEvent.setup()
    const userRepository = createTestUserRepository()
    for (const [questionId, text] of [
      ['P1-001', 'Part 1 개인 답변'],
      ['P3-001', 'Part 3 개인 답변'],
    ]) {
      await userRepository.upsertPracticeDraft({
        practice_draft_id: `pd-${questionId}`,
        question_id: questionId,
        input_language: 'ko',
        original_input: text,
        completion_status: 'completed',
        draft_status: 'draft',
      })
    }
    renderApp('/my-answers', { userRepository })

    await user.click(await screen.findByRole('tab', { name: '연습 초안 2' }))
    await user.selectOptions(screen.getByLabelText('파트 필터'), '1')
    expect(screen.getByText('Part 1 개인 답변')).toBeInTheDocument()
    expect(screen.queryByText('Part 3 개인 답변')).not.toBeInTheDocument()
    await expect(userRepository.listPracticeDrafts()).resolves.toHaveLength(2)
  })

  it('builds a Part 4 answer through understanding, planning, writing, and completion', async () => {
    const user = userEvent.setup()
    const { userRepository } = renderApp('/questions/P4-001')

    expect(await screen.findByText('1단계 · 질문 이해')).toBeInTheDocument()
    await user.click(screen.getByLabelText('질문을 이해했습니다'))
    await user.click(screen.getByRole('link', { name: '질문 이해 완료' }))

    expect(await screen.findByRole('heading', { name: '답변 설계' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('직접 답변 키워드'), '가족 여행')
    await user.type(screen.getByLabelText('이유 키워드'), '함께 시간 보내기')
    await user.click(screen.getByRole('button', { name: '답변 작성으로' }))

    await user.type(screen.getByLabelText('직접 답변 문장'), '가족과 여행하고 싶다.')
    await user.type(screen.getByLabelText('이유 문장'), '함께 시간을 보내고 싶다.')
    expect(
      within(screen.getByRole('region', { name: '전체 답변 미리보기' })).getByText(
        /가족과 여행하고 싶다\./,
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '연습 초안 저장' }))
    await user.click(screen.getByRole('button', { name: '답변 작성 완료' }))

    expect(await screen.findByRole('heading', { name: '내가 작성한 연습 답변' })).toBeInTheDocument()
    await expect(userRepository.getPracticeDraftByQuestionId('P4-001')).resolves.toMatchObject({
      completion_status: 'completed',
      planning_keywords: {
        direct_answer: ['가족 여행'],
        reasons: ['함께 시간 보내기'],
      },
      structured_answer: {
        direct_answer: '가족과 여행하고 싶다.',
        reasons: '함께 시간을 보내고 싶다.',
      },
    })
    await expect(userRepository.listUserAnswers()).resolves.toEqual([])
  })

  it('records explicit keyword recall and maps it to 헷갈림', async () => {
    const user = userEvent.setup()
    const userRepository = createTestUserRepository()
    await userRepository.upsertPracticeDraft({
      practice_draft_id: 'pd-P4-001',
      question_id: 'P4-001',
      input_language: 'ko',
      original_input: '가족과 여행하고 싶다.',
      planning_keywords: {
        direct_answer: ['가족 여행'],
        reasons: [],
        example: [],
        conclusion: [],
      },
      structured_answer: {
        direct_answer: '가족과 여행하고 싶다.',
        reasons: '',
        example: '',
        conclusion: '',
      },
      full_text: '가족과 여행하고 싶다.',
      completion_status: 'completed',
      draft_status: 'draft',
    })
    renderApp('/questions/P4-001/answer?step=recall', { userRepository })

    await user.click(await screen.findByRole('radio', { name: 'C. 키워드만 보기' }))
    expect(screen.getByText('가족 여행')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '답변 보기' }))
    await user.click(screen.getByRole('button', { name: '키워드 보고 말함' }))

    await waitFor(async () => {
      await expect(userRepository.getReviewState('question', 'P4-001')).resolves.toMatchObject({
        learning_status: '헷갈림',
      })
    })
    await expect(userRepository.listRecallAttemptsByQuestionId('P4-001')).resolves.toMatchObject([
      { recall_mode: 'keywords_only', result: 'used_keywords' },
    ])
  })

  it('shows AnswerPoint as an unreviewed hint and treats missing ModelAnswer as normal', async () => {
    renderApp('/questions/P4-006')

    const hint = await screen.findByRole('region', { name: '답변 구성 힌트' })
    expect(within(hint).getByText('검수 전 원본 포인트')).toBeInTheDocument()
    expect(
      within(hint).getByText('25초: 직접 답변 + 이유 2개 + 경험/예시 + 결론'),
    ).toBeInTheDocument()
    expect(within(hint).queryByText('모범답안')).not.toBeInTheDocument()
    expect(screen.getByText('아직 모범답안 없음')).toBeInTheDocument()
  })

  it('shows learner-facing working data status in direct answer and review contexts', async () => {
    renderApp('/questions/P4-006/answer')

    expect(await screen.findByText('원본 workbook 기반')).toBeInTheDocument()
    expect(screen.getByText('검수 전 문제')).toBeInTheDocument()

    cleanup()
    renderApp('/review')

    expect(await screen.findByText('원본 workbook 기반')).toBeInTheDocument()
    expect(screen.getByText('검수 전 문제')).toBeInTheDocument()
  })

  it('blocks a blank or whitespace-only answer', async () => {
    const user = userEvent.setup()
    renderApp('/questions/P4-006/answer')

    const editor = await screen.findByLabelText('내 답변')
    await user.type(editor, '   ')
    await user.click(screen.getByRole('button', { name: '교정하기' }))

    expect(screen.getByRole('alert')).toHaveTextContent('답변을 입력해 주세요')
    expect(editor).toHaveValue('   ')
    expect(screen.getByRole('heading', { name: '답변 작성' })).toBeInTheDocument()
  })

  it('shows the exact deterministic mock result and saves only after explicit approval', async () => {
    const user = userEvent.setup()
    const { userRepository } = renderApp('/questions/P4-006/answer')

    await user.type(await screen.findByLabelText('내 답변'), EXERCISE_INPUT)
    await user.click(screen.getByRole('button', { name: '교정하기' }))

    expect(
      await screen.findByText(CORRECTED_EXERCISE_INPUT, { exact: true }),
    ).toBeInTheDocument()
    expect(screen.getByText('수정 2개')).toBeInTheDocument()
    expect(screen.getAllByText('수정 전')).toHaveLength(2)
    expect(screen.getAllByText('수정 후')).toHaveLength(2)
    expect(
      screen.getByText('工作很忙，没有时间去健身房。', { exact: true }).closest('del'),
    ).not.toBeNull()
    expect(
      screen.getByText('因为工作很忙，我没有时间去健身房。', { exact: true }),
    ).toBeInTheDocument()
    await expect(userRepository.listUserAnswers()).resolves.toEqual([])

    await user.click(screen.getByRole('button', { name: '나의 답변으로 저장' }))

    expect(
      await screen.findByRole('heading', { name: '나의 답변' }),
    ).toBeInTheDocument()
    expect(screen.getByText(CORRECTED_EXERCISE_INPUT, { exact: true })).toBeInTheDocument()
    await expect(userRepository.listUserAnswers()).resolves.toHaveLength(1)
    await expect(userRepository.listReviewStates()).resolves.toEqual([])
    await expect(userRepository.listPersonalCorrections()).resolves.toHaveLength(2)

    await user.click(screen.getByRole('link', { name: '실수 노트' }))
    expect(
      await screen.findByText('工作很忙，没有时间去健身房。', { exact: true }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('개인 오류')).toHaveLength(2)
  })

  it('makes correction the primary memorization path for a Part 3 draft', async () => {
    const user = userEvent.setup()
    const provider: CorrectionProvider = {
      correct: vi.fn(async (request) => ({
        status: 'success' as const,
        original_input: request.original_input,
        result: {
          corrected_zh: '我一般周末运动两次。',
          pinyin: 'Wǒ yìbān zhōumò yùndòng liǎng cì.',
          ko: '저는 보통 주말에 두 번 운동합니다.',
          changes: [
            {
              before: '两个次',
              after: '两次',
              reason: '횟수를 셀 때는 两次라고 합니다.',
            },
          ],
          structure_segments: [],
          relevance_note: '',
          uncertainties: [],
          key_expressions: ['周末运动两次'],
        },
      })),
    }
    const { userRepository } = renderApp('/questions/P3-001/answer', {
      correctionProvider: provider,
    })

    await user.click(await screen.findByRole('radio', { name: '중국어로 작성' }))
    await user.type(screen.getByLabelText('내 답변'), '我周末两个次运动。')
    await user.click(screen.getByRole('button', { name: '답변 작성 완료' }))
    await user.click(await screen.findByRole('button', { name: '교정 후 암기' }))

    expect(await screen.findByText('내가 입력한 답변')).toBeInTheDocument()
    expect(screen.getByText('我周末两个次运动。', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('我一般周末运动两次。', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('周末运动两次')).toBeInTheDocument()
    await expect(userRepository.listUserAnswers()).resolves.toEqual([])
  })

  it('preserves a Part 3 original input across correction failure and retry', async () => {
    const user = userEvent.setup()
    const correct = vi
      .fn<CorrectionProvider['correct']>()
      .mockResolvedValueOnce({
        status: 'failure',
        original_input: '주말에는 친구를 만나요.',
        message: '교정 서버에 연결하지 못했습니다',
        error_code: 'network_error',
      })
      .mockResolvedValueOnce({
        status: 'success',
        original_input: '주말에는 친구를 만나요.',
        result: {
          corrected_zh: '周末我会见朋友。',
          pinyin: 'Zhōumò wǒ huì jiàn péngyou.',
          ko: '주말에는 친구를 만납니다.',
          changes: [],
          structure_segments: [],
          relevance_note: '',
          uncertainties: [],
        },
      })
    renderApp('/questions/P3-001/answer', {
      correctionProvider: { correct },
    })

    await user.type(await screen.findByLabelText('내 답변'), '주말에는 친구를 만나요.')
    await user.click(screen.getByRole('button', { name: '답변 작성 완료' }))
    await user.click(await screen.findByRole('button', { name: '교정 후 암기' }))

    expect(await screen.findByText('교정 서버에 연결하지 못했습니다')).toBeInTheDocument()
    expect(screen.getByText('주말에는 친구를 만나요.', { exact: true })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('周末我会见朋友。', { exact: true })).toBeInTheDocument()
    expect(correct).toHaveBeenCalledTimes(2)
  })

  it('preserves the allowlisted My Answers origin through question and answer routes', async () => {
    const user = userEvent.setup()
    const userRepository = createTestUserRepository()
    await userRepository.upsertUserAnswer(makeSavedAnswer())
    renderApp('/my-answers', { userRepository })

    await user.click(
      await screen.findByRole('link', { name: '연결된 문제' }),
    )

    expect(
      await screen.findByRole('link', { name: '← 나의 답변' }),
    ).toHaveAttribute('href', '/my-answers')
    expect(
      screen.getByRole('link', { name: '나의 답변' }),
    ).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('link', { name: '다시 작성' }))
    expect(
      await screen.findByRole('link', { name: '← 문제로 돌아가기' }),
    ).toHaveAttribute('href', '/questions/P4-006')

    await user.click(screen.getByRole('link', { name: '← 문제로 돌아가기' }))
    expect(
      await screen.findByRole('link', { name: '← 나의 답변' }),
    ).toHaveAttribute('href', '/my-answers')
  })

  it('preserves unsupported input and disables saving', async () => {
    const user = userEvent.setup()
    const { userRepository } = renderApp('/questions/P4-001/answer')

    await user.type(await screen.findByLabelText('내 답변'), '저는 서울에 살아요.')
    await user.click(screen.getByRole('button', { name: '교정하기' }))

    expect(
      await screen.findByText('현재 개발용 mock이 지원하지 않는 입력입니다'),
    ).toBeInTheDocument()
    expect(screen.getByText('저는 서울에 살아요.')).toBeInTheDocument()
    expect(screen.getByText(/실제 AI가 연결되지/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '나의 답변으로 저장' })).toBeDisabled()
    await expect(userRepository.listUserAnswers()).resolves.toEqual([])
  })

  it('visibly preserves the original input when correction fails', async () => {
    const user = userEvent.setup()
    const failureProvider: CorrectionProvider = {
      correct: async (request) => ({
        status: 'failure',
        original_input: request.original_input,
        message: '교정 요청을 처리하지 못했습니다',
        error_code: 'test_failure',
      }),
    }
    renderApp('/questions/P4-006/answer', {
      correctionProvider: failureProvider,
    })

    await user.type(await screen.findByLabelText('내 답변'), EXERCISE_INPUT)
    await user.click(screen.getByRole('button', { name: '교정하기' }))

    expect(
      await screen.findByText('교정 요청을 처리하지 못했습니다'),
    ).toBeInTheDocument()
    expect(screen.getByText(EXERCISE_INPUT, { exact: true })).toBeInTheDocument()
  })

  it('stores an unsupported answer as a PracticeDraft and restores it', async () => {
    const user = userEvent.setup()
    const userRepository = createTestUserRepository()
    renderApp('/questions/P4-001/answer', { userRepository })

    await user.type(await screen.findByLabelText('내 답변'), '저는 서울에 살아요.')
    await user.click(screen.getByRole('button', { name: '연습 초안 저장' }))
    expect(await screen.findByText('연습 초안을 저장했습니다')).toBeInTheDocument()
    await expect(
      userRepository.getPracticeDraftByQuestionId('P4-001'),
    ).resolves.toMatchObject({
      original_input: '저는 서울에 살아요.',
      draft_status: 'draft',
    })
    await expect(userRepository.listUserAnswers()).resolves.toEqual([])

    cleanup()
    renderApp('/questions/P4-001/answer', { userRepository })
    expect(await screen.findByLabelText('내 답변')).toHaveValue('저는 서울에 살아요.')
  })

  it('keeps PracticeDraft and approved UserAnswer as separate My Answers records', async () => {
    const user = userEvent.setup()
    const userRepository = createTestUserRepository()
    await userRepository.upsertPracticeDraft({
      practice_draft_id: 'pd-P4-006',
      question_id: 'P4-006',
      input_language: 'ko',
      original_input: '교정 전 연습 초안',
      draft_status: 'draft',
    })
    await userRepository.upsertUserAnswer(makeSavedAnswer())

    renderApp('/my-answers', { userRepository })

    expect(await screen.findByRole('tab', { name: '교정 완료 1' })).toBeInTheDocument()
    expect(screen.getByText(CORRECTED_EXERCISE_INPUT, { exact: true })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '연습 초안 1' }))
    expect(screen.getByText('교정 전 연습 초안')).toBeInTheDocument()
    expect(screen.getByText('원본 입력 · 한국어')).toBeInTheDocument()
    await expect(userRepository.listUserAnswers()).resolves.toHaveLength(1)
    await expect(userRepository.listPracticeDrafts()).resolves.toHaveLength(1)
  })

  it('shows previous and next questions, display toggles, and separate course guidance', async () => {
    const user = userEvent.setup()
    renderApp('/questions/P4-006')

    expect(await screen.findByRole('link', { name: /이전 문제.*P4-005/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /다음 문제.*P4-007/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '강의 기반 기초 구조' })).toBeInTheDocument()
    expect(screen.getByText(/3급 과정 맥락/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '재사용 표현' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '한국어 숨기기' }))
    expect(screen.getByText('한국어 뜻이 숨겨져 있습니다')).toBeInTheDocument()
  })

  it('records and restores the last visited Question on HOME', async () => {
    const userRepository = createTestUserRepository()
    renderApp('/questions/P4-006', { userRepository })
    expect(await screen.findByText(/P4-006/)).toBeInTheDocument()

    cleanup()
    renderApp('/', { userRepository })
    expect(await screen.findByRole('link', { name: /P4-006 이어서 보기/ })).toHaveAttribute(
      'href',
      '/questions/P4-006',
    )
  })
})

describe('review flow', () => {
  it('filters all fifty review questions by search, type, and explicit state', async () => {
    const user = userEvent.setup()
    const userRepository = createTestUserRepository()
    await userRepository.upsertReviewState({
      review_state_id: 'rs-question-P4-006',
      target_type: 'question',
      target_id: 'P4-006',
      learning_status: '헷갈림',
    })
    renderApp('/review', { userRepository })

    await user.selectOptions(await screen.findByLabelText('파트 필터'), '4')
    expect(await screen.findByText('현재 결과 50개')).toBeInTheDocument()
    await user.type(screen.getByLabelText('문제 검색'), '어디에서 운동')
    expect(screen.getByText('현재 결과 1개')).toBeInTheDocument()
    expect(screen.getByText(/P4-006/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '필터 초기화' }))
    await user.selectOptions(screen.getByLabelText('복습 상태 필터'), '헷갈림')
    expect(screen.getByText('현재 결과 1개')).toBeInTheDocument()
    expect(screen.getByText(/P4-006/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('유형 필터'), '운동')
    expect(screen.getByText('현재 결과 1개')).toBeInTheDocument()
  })

  it('creates ReviewState only after the learner explicitly selects a status', async () => {
    const user = userEvent.setup()
    const { userRepository } = renderApp('/review')

    await user.selectOptions(await screen.findByLabelText('파트 필터'), '4')
    expect(await screen.findByText(/P4-001/)).toBeInTheDocument()
    expect(screen.getByText('답변이 숨겨져 있습니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음 문제' })).toBeDisabled()
    await expect(userRepository.listReviewStates()).resolves.toEqual([])

    await user.click(screen.getByRole('button', { name: '답변 보기' }))
    expect(screen.getByText('저장된 내 답변 없음')).toBeInTheDocument()
    expect(screen.getByText('아직 모범답안 없음')).toBeInTheDocument()
    await expect(userRepository.listReviewStates()).resolves.toEqual([])

    await user.click(screen.getByRole('button', { name: '헷갈림' }))

    await waitFor(async () => {
      await expect(userRepository.getReviewState('question', 'P4-001')).resolves.toMatchObject({
        learning_status: '헷갈림',
        review_count: 1,
      })
    })
    expect(screen.getByRole('button', { name: '다음 문제' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '다음 문제' }))
    expect(screen.getByText(/P4-002/)).toBeInTheDocument()
    expect(screen.getByText('답변이 숨겨져 있습니다')).toBeInTheDocument()

    const remainingIds = Array.from(
      { length: 49 },
      (_, index) => `P4-${String(index + 2).padStart(3, '0')}`,
    )
    for (const questionId of remainingIds) {
      expect(screen.getByText(new RegExp(questionId))).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '다음 문제' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: '외움' }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '다음 문제' })).toBeEnabled(),
      )
      await user.click(screen.getByRole('button', { name: '다음 문제' }))
    }

    expect(screen.getByRole('heading', { name: '복습 완료' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 복습' }))

    expect(screen.getByText(/P4-001/)).toBeInTheDocument()
    expect(screen.getByText('답변이 숨겨져 있습니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음 문제' })).toBeDisabled()
    expect(screen.getByText('헷갈림', { selector: '[data-status]' })).toBeInTheDocument()
  })

  it('keeps Next disabled and reports an alert when ReviewState persistence fails', async () => {
    const user = userEvent.setup()
    const baseRepository = createTestUserRepository()
    const rejectingRepository: UserDataRepository = {
      ...baseRepository,
      upsertReviewState: async () => {
        throw new Error('simulated IndexedDB rejection')
      },
    }
    renderApp('/review', { userRepository: rejectingRepository })

    await user.selectOptions(await screen.findByLabelText('파트 필터'), '4')
    expect(await screen.findByText(/P4-001/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '못 외움' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '복습 상태를 저장하지 못했습니다',
    )
    expect(screen.getByRole('button', { name: '다음 문제' })).toBeDisabled()
    await expect(baseRepository.listReviewStates()).resolves.toEqual([])
  })
})
