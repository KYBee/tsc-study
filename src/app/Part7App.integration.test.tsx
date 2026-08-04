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

function renderPart7(path: string, repository?: UserDataRepository) {
  const userRepository =
    repository ??
    createUserDataRepository({
      databaseName: `tsc-study-part7-ui-${databaseSequence++}`,
      now: () => '2026-07-31T10:00:00.000Z',
    })
  if (!repositories.includes(userRepository)) repositories.push(userRepository)
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

describe('Part 7 story visual learning slice', () => {
  it('activates Part 7 on HOME in development and lists twelve story sets', async () => {
    const user = userEvent.setup()
    renderPart7('/')
    const parts = await screen.findByRole('list', { name: 'Part 목록' })
    expect(
      within(parts).getByRole('link', {
        name: /Part 7.*스토리 구성하기.*12세트/,
      }),
    ).toHaveAttribute('href', '/parts/7')

    await user.click(
      within(parts).getByRole('link', {
        name: /Part 7.*스토리 구성하기/,
      }),
    )
    const setList = await screen.findByRole('list', {
      name: 'Part 7 스토리 그림 세트',
    })
    expect(within(setList).getAllByTestId('story-set-id')).toHaveLength(12)
    expect(within(setList).getAllByRole('img')).toHaveLength(12)
    expect(screen.getByText('현재 결과 12개')).toBeInTheDocument()
  })

  it('shows the explicit StoryGuide and candidate boundary without an answer claim', async () => {
    const user = userEvent.setup()
    renderPart7('/parts/7/sets/vs-P7-V01')

    expect(
      await screen.findByRole('heading', { name: 'Part 7 스토리 그림 세트 1' }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('img', { name: /Part 7 세트 1 검수 전 그림 장면 [1-4]/ }),
    ).toHaveLength(4)
    expect(screen.getByText('Part 7 공통 안내')).toBeInTheDocument()
    expect(screen.getByText('请根据四幅连续的图片，讲述一个完整的故事。')).toBeInTheDocument()

    const guide = screen.getByText('원본 이야기 흐름 참고').closest('details')
    expect(guide).not.toHaveAttribute('open')
    await user.click(screen.getByText('원본 이야기 흐름 참고'))
    expect(guide).toHaveAttribute('open')
    expect(
      screen.getByText(/완성 답변이나 공식 정답이 아닙니다/),
    ).toBeInTheDocument()
    expect(screen.queryByText('ModelAnswer')).not.toBeInTheDocument()
    expect(screen.queryByText('모범 정답')).not.toBeInTheDocument()

    await user.click(screen.getByText('데이터 연결 상태'))
    expect(screen.getByText('확정 연결 없음')).toBeInTheDocument()
    expect(screen.getByText(/원본 문제 번호의 연결은 아직 검수되지/)).toBeInTheDocument()
  })

  it('expands an image and gives the shared setup command after load failure', async () => {
    const user = userEvent.setup()
    renderPart7('/parts/7/sets/vs-P7-V01')

    await user.click(
      await screen.findByRole('button', { name: '세트 1 그림 장면 1 확대' }),
    )
    expect(screen.getByRole('dialog', { name: '그림 확대 보기' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '확대 닫기' }))

    fireEvent.error(
      screen.getByRole('img', { name: 'Part 7 세트 1 검수 전 그림 장면 1' }),
    )
    expect(screen.getByText('로컬 그림 자산이 준비되지 않았습니다.')).toBeInTheDocument()
    expect(screen.getByText('npm run assets:visual-local')).toBeInTheDocument()
  })

  it('stores only the learner story and requires confirmation before copying a guide', async () => {
    const user = userEvent.setup()
    const { userRepository } = renderPart7(
      '/parts/7/sets/vs-P7-V01/answer',
    )

    expect(
      await screen.findByRole('heading', { name: '내 이야기 만들기' }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('img', { name: /Part 7 세트 1 검수 전 그림 장면 [1-4]/ }),
    ).toHaveLength(4)
    await user.type(screen.getByLabelText('이야기 핵심 키워드'), '아침\n버스')
    await user.type(screen.getByLabelText('새 이야기 포인트'), '아침에 일어난다')
    await user.click(screen.getByRole('button', { name: '포인트 추가' }))
    await user.type(screen.getByLabelText('새 이야기 포인트'), '버스를 탄다')
    await user.click(screen.getByRole('button', { name: '포인트 추가' }))
    await user.click(screen.getByRole('button', { name: '두 번째 포인트 위로 이동' }))
    expect(screen.getByLabelText('이야기 포인트 1')).toHaveValue('버스를 탄다')

    await user.click(screen.getByText('원본 이야기 흐름 참고'))
    await user.click(screen.getByRole('button', { name: '내 이야기 포인트로 참고' }))
    expect(
      screen.getByRole('dialog', { name: '원본 가이드 참고 미리보기' }),
    ).toBeInTheDocument()
    await expect(userRepository.listPracticeDrafts()).resolves.toEqual([])
    await user.click(screen.getByRole('button', { name: '참고 내용 복사 확인' }))
    expect(screen.getByLabelText('이야기 포인트 3')).not.toHaveValue('')
    await expect(userRepository.listPracticeDrafts()).resolves.toEqual([])

    await user.type(screen.getByLabelText('내 전체 답변'), '내가 직접 쓴 전체 이야기')
    await user.click(screen.getByRole('button', { name: '연습 초안 저장' }))
    await expect(
      userRepository.getPracticeDraftByTarget('visual_set', 'vs-P7-V01'),
    ).resolves.toMatchObject({
      target_type: 'visual_set',
      story_keywords: ['아침', '버스'],
      story_points: [
        expect.objectContaining({ text: '버스를 탄다', order: 1 }),
        expect.objectContaining({ text: '아침에 일어난다', order: 2 }),
        expect.objectContaining({
          text: '구매 → 자랑 → 음료를 쏟음 → 얼룩을 지움',
          order: 3,
        }),
      ],
      original_input: '내가 직접 쓴 전체 이야기',
      completion_status: 'in_progress',
    })
    await expect(userRepository.listUserAnswers()).resolves.toEqual([])
  })

  it('edits, deletes, and reloads learner-owned story points', async () => {
    const user = userEvent.setup()
    const { userRepository } = renderPart7(
      '/parts/7/sets/vs-P7-V02/answer',
    )
    await screen.findByRole('heading', { name: '내 이야기 만들기' })
    await user.type(screen.getByLabelText('새 이야기 포인트'), '첫 장면')
    await user.click(screen.getByRole('button', { name: '포인트 추가' }))
    await user.type(screen.getByLabelText('새 이야기 포인트'), '지울 장면')
    await user.click(screen.getByRole('button', { name: '포인트 추가' }))
    await user.clear(screen.getByLabelText('이야기 포인트 1'))
    await user.type(screen.getByLabelText('이야기 포인트 1'), '수정한 첫 장면')
    await user.click(screen.getByRole('button', { name: '2번째 포인트 삭제' }))
    await user.click(screen.getByRole('button', { name: '연습 초안 저장' }))

    cleanup()
    renderPart7('/parts/7/sets/vs-P7-V02/answer', userRepository)
    expect(await screen.findByLabelText('이야기 포인트 1')).toHaveValue(
      '수정한 첫 장면',
    )
    expect(screen.queryByLabelText('이야기 포인트 2')).not.toBeInTheDocument()
  })

  it('completes, recalls, and exposes the same VisualSet draft in My Answers and Review', async () => {
    const user = userEvent.setup()
    const { userRepository } = renderPart7(
      '/parts/7/sets/vs-P7-V01/answer',
    )
    await user.type(
      await screen.findByLabelText('이야기 핵심 키워드'),
      '약속',
    )
    await user.type(screen.getByLabelText('새 이야기 포인트'), '친구를 만난다')
    await user.click(screen.getByRole('button', { name: '포인트 추가' }))
    await user.type(screen.getByLabelText('내 전체 답변'), '친구를 만났다.')
    await user.click(screen.getByRole('button', { name: '답변 작성 완료' }))
    await user.click(await screen.findByRole('button', { name: '암기 시작' }))
    await user.click(screen.getByRole('radio', { name: '그림만' }))
    expect(
      screen.getAllByRole('img', { name: /Part 7 세트 1 검수 전 그림 장면 [1-4]/ }),
    ).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: '내 답변 보기' }))
    await user.click(
      screen.getByRole('button', { name: '이야기 순서를 보고 말함' }),
    )

    await waitFor(async () => {
      await expect(
        userRepository.getReviewState('visual_set', 'vs-P7-V01'),
      ).resolves.toMatchObject({ learning_status: '헷갈림' })
    })
    await expect(
      userRepository.listRecallAttemptsByTarget('visual_set', 'vs-P7-V01'),
    ).resolves.toEqual([
      expect.objectContaining({
        recall_mode: 'visual_only',
        result: 'used_keywords',
      }),
    ])

    cleanup()
    renderPart7('/my-answers', userRepository)
    await user.click(await screen.findByRole('tab', { name: /연습 초안/ }))
    await user.selectOptions(screen.getByLabelText('파트 필터'), '7')
    expect(screen.getByText('Part 7 · 스토리 그림 세트 1')).toBeInTheDocument()
    expect(screen.getByText('친구를 만났다.')).toBeInTheDocument()
    expect(screen.queryByText('교정 완료')).not.toBeInTheDocument()

    cleanup()
    renderPart7('/review', userRepository)
    await user.selectOptions(await screen.findByLabelText('파트 필터'), '7')
    await user.selectOptions(screen.getByLabelText('문제 종류'), 'story')
    expect(screen.getByText('현재 결과 12개')).toBeInTheDocument()
    expect(
      screen.getAllByRole('img', { name: /Part 7 세트 1 검수 전 그림 장면 [1-4]/ }),
    ).toHaveLength(4)
  })
})
