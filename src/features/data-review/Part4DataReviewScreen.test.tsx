import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { App } from '../../app/App'
import { createPublicContentRepository } from '../../data/publicContentRepository'
import {
  createReviewDecisionRepository,
  type ReviewDecisionRepository,
} from '../../data/reviewDecisionRepository'
import {
  createUserDataRepository,
  type UserDataRepository,
} from '../../data/userDataRepository'
import { MockCorrectionProvider } from '../../providers/MockCorrectionProvider'

const reviewRepositories: ReviewDecisionRepository[] = []
const userRepositories: UserDataRepository[] = []

function renderReview(
  reviewRepository = createReviewDecisionRepository({
    databaseName: `data-review-ui-${crypto.randomUUID()}`,
  }),
) {
  const userRepository = createUserDataRepository({
    databaseName: `data-review-learning-${crypto.randomUUID()}`,
  })
  if (!reviewRepositories.includes(reviewRepository)) {
    reviewRepositories.push(reviewRepository)
  }
  userRepositories.push(userRepository)
  render(
    <App
      initialEntries={['/data-review/part4']}
      dependencies={{
        publicRepository: createPublicContentRepository(),
        userRepository,
        correctionProvider: new MockCorrectionProvider(),
        reviewDecisionRepository: reviewRepository,
      }}
    />,
  )
  return reviewRepository
}

afterEach(async () => {
  cleanup()
  vi.restoreAllMocks()
  await Promise.all(
    reviewRepositories.splice(0).map((repository) => repository.destroy()),
  )
  await Promise.all(
    userRepositories.splice(0).map((repository) => repository.destroy()),
  )
})

describe('Part 4 local data review screen', () => {
  it('shows fifty unreviewed items without the learning bottom navigation', async () => {
    const repository = renderReview()
    expect(
      await screen.findByRole('heading', { name: 'Part 4 원문 검수' }),
    ).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Part 4 검수 대상 목록' })
    expect(within(list).getAllByRole('button')).toHaveLength(50)
    const summary = screen.getByRole('region', { name: '검수 현황' })
    expect(within(summary).getByText('미검수').nextElementSibling).toHaveTextContent('50')
    expect(screen.queryByRole('navigation', { name: '하단 메뉴' })).not.toBeInTheDocument()
    expect(await repository.list()).toEqual([])
  })

  it('searches Chinese and Korean and filters by question type', async () => {
    const user = userEvent.setup()
    renderReview()
    const search = await screen.findByLabelText('검수 질문 검색')
    await user.type(search, '어디에서 운동')
    expect(screen.getByText('현재 결과 1개')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /P4-006/ })).toBeInTheDocument()

    await user.clear(search)
    await user.selectOptions(screen.getByLabelText('검수 유형 필터'), '운동')
    expect(screen.getByText('현재 결과 2개')).toBeInTheDocument()
  })

  it('saves only an explicit complete approval and restores it after rerender', async () => {
    const user = userEvent.setup()
    const repository = renderReview()
    await screen.findByRole('heading', { name: '개별 검수' })
    await user.click(screen.getByRole('button', { name: '전체 필드 승인' }))
    await user.type(screen.getByLabelText('검수자 표시명'), '로컬 검수자')
    await user.click(screen.getByRole('button', { name: '검수 결정 저장' }))
    expect(await screen.findByRole('status')).toHaveTextContent('저장했습니다')
    expect((await repository.list())[0].overall_status).toBe('approved')

    cleanup()
    renderReview(repository)
    expect(await screen.findByText('계산된 전체 상태:')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '승인' })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('requires a note for needs_fix and confirms before reset', async () => {
    const user = userEvent.setup()
    const repository = renderReview()
    await screen.findByRole('heading', { name: '개별 검수' })
    await user.click(screen.getByRole('button', { name: '전체 수정 필요' }))
    await user.type(screen.getByLabelText('검수자 표시명'), '검수자')
    await user.click(screen.getByRole('button', { name: '검수 결정 저장' }))
    expect(screen.getByRole('alert')).toHaveTextContent('수정 필요 사유')
    expect(await repository.list()).toEqual([])

    await user.type(screen.getByLabelText('검수 메모'), '병음 확인 필요')
    await user.click(screen.getByRole('button', { name: '검수 결정 저장' }))
    await waitFor(async () => expect(await repository.list()).toHaveLength(1))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: '로컬 결정 초기화' }))
    expect(confirm).toHaveBeenCalled()
    await waitFor(async () => expect(await repository.list()).toEqual([]))
  })
})
