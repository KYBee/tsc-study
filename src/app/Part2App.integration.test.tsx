import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { createPublicContentRepository } from '../data/publicContentRepository'
import {
  createUserDataRepository,
  type UserDataRepository,
} from '../data/userDataRepository'
import { MockCorrectionProvider } from '../providers/MockCorrectionProvider'
import { App } from './App'

const repositories: UserDataRepository[] = []
let databaseSequence = 0

function renderPart2(path: string) {
  const userRepository = createUserDataRepository({
    databaseName: `tsc-study-part2-ui-${databaseSequence++}`,
    now: () => '2026-07-30T10:00:00.000Z',
  })
  repositories.push(userRepository)
  render(
    <App
      initialEntries={[path]}
      dependencies={{
        publicRepository: createPublicContentRepository(),
        userRepository,
        correctionProvider: new MockCorrectionProvider(),
      }}
    />,
  )
  return { userRepository }
}

afterEach(async () => {
  cleanup()
  await Promise.all(repositories.splice(0).map((item) => item.destroy()))
  window.localStorage.clear()
})

describe('Part 2 visual learning slice', () => {
  it('keeps Part 2 active alongside the separate Part 7 story slice', async () => {
    renderPart2('/')
    const parts = await screen.findByRole('list', { name: 'Part 목록' })

    expect(
      within(parts).getByRole('link', {
        name: /Part 2.*그림 보고 답하기.*12세트.*48문항/,
      }),
    ).toHaveAttribute('href', '/parts/2')
    expect(
      within(parts).getByRole('link', {
        name: /Part 7.*스토리 구성하기.*12세트/,
      }),
    ).toHaveAttribute('href', '/parts/7')
  })

  it('shows twelve sets and four questions per set with local images', async () => {
    const user = userEvent.setup()
    renderPart2('/parts/2')

    const setList = await screen.findByRole('list', { name: 'Part 2 그림 세트' })
    expect(within(setList).getAllByTestId('visual-set-id')).toHaveLength(12)
    expect(within(setList).getAllByRole('img')).toHaveLength(12)
    await user.click(
      within(setList).getByRole('link', { name: /^세트 1 · 질문 4개/ }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Part 2 그림 세트 1' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /세트 1 검수 전 그림/ })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '세부 질문 4개' }).children).toHaveLength(4)
  })

  it('stores each set question answer and memorization status independently', async () => {
    const user = userEvent.setup()
    const { userRepository } = renderPart2('/parts/2/sets/vs-P2-V01')

    const question1 = await screen.findByRole('article', { name: '질문 1 학습' })
    const question2 = screen.getByRole('article', { name: '질문 2 학습' })
    await user.type(within(question1).getByLabelText('질문 1 내 답변'), '他在跑步。')
    await user.click(within(question1).getByRole('button', { name: '답변 저장' }))
    await user.type(within(question2).getByLabelText('질문 2 내 답변'), '她坐在长椅上。')
    await user.click(within(question2).getByRole('button', { name: '답변 저장' }))

    await user.click(within(question1).getByRole('button', { name: '외움' }))
    await user.click(within(question2).getByRole('button', { name: '못 외움' }))

    await expect(
      userRepository.getPracticeDraftByTarget('visual_question', 'vq-P2-V01-Q1'),
    ).resolves.toMatchObject({ original_input: '他在跑步。' })
    await expect(
      userRepository.getPracticeDraftByTarget('visual_question', 'vq-P2-V01-Q2'),
    ).resolves.toMatchObject({ original_input: '她坐在长椅上。' })
    await expect(
      userRepository.getReviewState('visual_question', 'vq-P2-V01-Q1'),
    ).resolves.toMatchObject({ learning_status: '외움' })
    await expect(
      userRepository.getReviewState('visual_question', 'vq-P2-V01-Q2'),
    ).resolves.toMatchObject({ learning_status: '못 외움' })
  })

  it('expands a registered image and gives setup guidance after load failure', async () => {
    const user = userEvent.setup()
    renderPart2('/parts/2/sets/vs-P2-V01')

    const expandButton = await screen.findByRole('button', {
      name: '세트 1 그림 확대',
    })
    await user.click(expandButton)
    expect(screen.getByRole('dialog', { name: '그림 확대 보기' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '확대 닫기' }))
    expect(screen.queryByRole('dialog', { name: '그림 확대 보기' })).not.toBeInTheDocument()

    fireEvent.error(screen.getByRole('img', { name: /세트 1 검수 전 그림/ }))
    expect(screen.getByText('로컬 그림 자산이 준비되지 않았습니다.')).toBeInTheDocument()
    expect(
      screen.getByText('npm run assets:visual-local'),
    ).toBeInTheDocument()
  })

  it('shows the image, language toggles, and unverified source answer', async () => {
    const user = userEvent.setup()
    renderPart2('/visual-questions/vq-P2-V01-Q1')

    expect(
      await screen.findByRole('heading', { name: '세부 질문 1' }),
    ).toBeInTheDocument()
    expect(screen.getByText('男的在做什么？')).toBeInTheDocument()
    const questionLanguage = screen.getByRole('region', { name: '세부 질문 1' })
    await user.click(
      within(questionLanguage).getByRole('button', { name: '병음 숨기기' }),
    )
    expect(screen.getByText('병음이 숨겨져 있습니다')).toBeInTheDocument()

    const answerPanel = screen.getByText('원본 추천 답변').closest('details')
    expect(answerPanel).not.toHaveAttribute('open')
    await user.click(screen.getByText('원본 추천 답변'))
    expect(answerPanel).toHaveAttribute('open')
    expect(screen.getByText('男的正在跑步。')).toBeInTheDocument()
    expect(
      screen.getByText(/공식 정답이나 검수 완료 답변이 아닙니다/),
    ).toBeInTheDocument()
  })

  it('stores a visual-question PracticeDraft without creating UserAnswer', async () => {
    const user = userEvent.setup()
    const { userRepository } = renderPart2(
      '/visual-questions/vq-P2-V01-Q1/answer',
    )

    await user.type(await screen.findByLabelText('내 짧은 답변'), '그는 달리고 있습니다.')
    await user.click(screen.getByRole('button', { name: '연습 초안 저장' }))
    expect(await screen.findByText('연습 초안을 저장했습니다')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '답변 작성 완료' }))

    await expect(
      userRepository.getPracticeDraftByTarget(
        'visual_question',
        'vq-P2-V01-Q1',
      ),
    ).resolves.toMatchObject({
      original_input: '그는 달리고 있습니다.',
      completion_status: 'completed',
    })
    await expect(userRepository.listUserAnswers()).resolves.toEqual([])
  })

  it('records picture-only recall and maps the explicit review state', async () => {
    const user = userEvent.setup()
    const { userRepository } = renderPart2(
      '/visual-questions/vq-P2-V01-Q1/answer',
    )
    await user.type(await screen.findByLabelText('내 짧은 답변'), '他在跑步。')
    await user.click(screen.getByRole('button', { name: '답변 작성 완료' }))
    await user.click(await screen.findByRole('button', { name: '암기 시작' }))
    await user.click(screen.getByRole('radio', { name: '그림만' }))
    await user.click(screen.getByRole('button', { name: '내 답변 보기' }))
    await user.click(screen.getByRole('button', { name: '어느 정도 말함' }))

    await waitFor(async () => {
      await expect(
        userRepository.getReviewState(
          'visual_question',
          'vq-P2-V01-Q1',
        ),
      ).resolves.toMatchObject({ learning_status: '헷갈림' })
    })
    await expect(
      userRepository.listRecallAttemptsByTarget(
        'visual_question',
        'vq-P2-V01-Q1',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        recall_mode: 'visual_only',
        result: 'used_keywords',
      }),
    ])
  })

  it('shows Part 2 drafts in My Answers without treating them as corrected answers', async () => {
    const userRepository = createUserDataRepository({
      databaseName: `tsc-study-part2-ui-${databaseSequence++}`,
      now: () => '2026-07-30T10:00:00.000Z',
    })
    repositories.push(userRepository)
    await userRepository.upsertPracticeDraft({
      practice_draft_id: 'pd-vq-P2-V01-Q1',
      question_id: 'vq-P2-V01-Q1',
      target_type: 'visual_question',
      target_id: 'vq-P2-V01-Q1',
      input_language: 'zh',
      original_input: '他在跑步。',
      completion_status: 'completed',
      draft_status: 'draft',
    })
    render(
      <App
        initialEntries={['/my-answers']}
        dependencies={{
          publicRepository: createPublicContentRepository(),
          userRepository,
          correctionProvider: new MockCorrectionProvider(),
        }}
      />,
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('tab', { name: /연습 초안/ }))

    expect(screen.getByText(/Part 2 · 세트 1 · 질문 1/)).toBeInTheDocument()
    expect(screen.getByText('他在跑步。')).toBeInTheDocument()
    expect(screen.queryByText('교정 완료 답변')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '암기 시작' }),
    ).toHaveAttribute(
      'href',
      '/visual-questions/vq-P2-V01-Q1/recall',
    )
  })

  it('includes visual questions in Review with their picture', async () => {
    const user = userEvent.setup()
    renderPart2('/review')

    await user.selectOptions(
      await screen.findByLabelText('파트 필터'),
      '2',
    )
    await user.selectOptions(screen.getByLabelText('문제 종류'), 'visual')
    expect(screen.getByText('현재 결과 48개')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /Part 2 세트 1 검수 전 그림/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('男的在做什么？')).toBeInTheDocument()
  })
})
