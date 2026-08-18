import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import {
  createUserDataRepository,
  type UserDataRepository,
} from '../data/userDataRepository'
import { LearningStatusButtons } from './LearningStatusButtons'

const repositories: UserDataRepository[] = []
let databaseSequence = 0

function createRepository(): UserDataRepository {
  const repository = createUserDataRepository({
    databaseName: `tsc-learning-status-${databaseSequence++}`,
    now: () => '2026-08-18T10:00:00.000Z',
  })
  repositories.push(repository)
  return repository
}

afterEach(async () => {
  cleanup()
  await Promise.all(repositories.splice(0).map((repository) => repository.destroy()))
})

describe('LearningStatusButtons', () => {
  it('shows only the simple 못 외움 and 외움 choices', () => {
    const repository = createRepository()
    render(
      <LearningStatusButtons
        targetType="question"
        targetId="P3-001"
        userRepository={repository}
      />,
    )

    expect(screen.getByRole('button', { name: '못 외움' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '외움' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '헷갈림' })).not.toBeInTheDocument()
  })

  it('stores each explicit status independently from an answer', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(
      <LearningStatusButtons
        targetType="visual_question"
        targetId="vq-P2-V01-Q1"
        userRepository={repository}
      />,
    )

    await user.click(screen.getByRole('button', { name: '못 외움' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      '암기 상태를 저장했습니다.',
    )
    await expect(
      repository.getReviewState('visual_question', 'vq-P2-V01-Q1'),
    ).resolves.toMatchObject({ learning_status: '못 외움' })
    await expect(repository.listPracticeDrafts()).resolves.toEqual([])

    await user.click(screen.getByRole('button', { name: '외움' }))
    await expect(
      repository.getReviewState('visual_question', 'vq-P2-V01-Q1'),
    ).resolves.toMatchObject({ learning_status: '외움' })
    await expect(repository.listPracticeDrafts()).resolves.toEqual([])
  })

  it('preserves a confused state without exposing it as a primary choice', async () => {
    const repository = createRepository()
    const review = await repository.upsertReviewState({
      review_state_id: 'rs-question-P3-001',
      target_type: 'question',
      target_id: 'P3-001',
      learning_status: '헷갈림',
    })
    render(
      <LearningStatusButtons
        targetType="question"
        targetId="P3-001"
        initialReviewState={review}
        userRepository={repository}
      />,
    )

    expect(screen.getByText('현재 상태: 헷갈림')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '헷갈림' })).not.toBeInTheDocument()
    await expect(
      repository.getReviewState('question', 'P3-001'),
    ).resolves.toMatchObject({ learning_status: '헷갈림' })
  })

  it('keeps the current status when persistence fails', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    const existing = await repository.upsertReviewState({
      review_state_id: 'rs-visual-set-vs-P7-V01',
      target_type: 'visual_set',
      target_id: 'vs-P7-V01',
      learning_status: '못 외움',
    })
    const failingRepository: UserDataRepository = {
      ...repository,
      upsertReviewState: async () => {
        throw new Error('write failed')
      },
    }
    render(
      <LearningStatusButtons
        targetType="visual_set"
        targetId="vs-P7-V01"
        initialReviewState={existing}
        userRepository={failingRepository}
      />,
    )

    await user.click(screen.getByRole('button', { name: '외움' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '암기 상태를 저장하지 못했습니다',
    )
    expect(screen.getByRole('button', { name: '못 외움' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
