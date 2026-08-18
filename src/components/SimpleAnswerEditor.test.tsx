import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import {
  createUserDataRepository,
  type UserDataRepository,
} from '../data/userDataRepository'
import { SimpleAnswerEditor } from './SimpleAnswerEditor'

const repositories: UserDataRepository[] = []
let databaseSequence = 0

function createRepository(): UserDataRepository {
  const repository = createUserDataRepository({
    databaseName: `tsc-simple-answer-editor-${databaseSequence++}`,
    now: () => '2026-08-18T10:00:00.000Z',
  })
  repositories.push(repository)
  return repository
}

afterEach(async () => {
  cleanup()
  await Promise.all(repositories.splice(0).map((repository) => repository.destroy()))
})

describe('SimpleAnswerEditor', () => {
  it('restores a saved draft before a corrected-answer fallback', async () => {
    const repository = createRepository()
    const draft = await repository.upsertPracticeDraft({
      practice_draft_id: 'pd-P3-001',
      question_id: 'P3-001',
      target_type: 'question',
      target_id: 'P3-001',
      input_language: 'zh',
      original_input: '초안 원문',
      full_text: '초안 전체 답변',
      completion_status: 'completed',
      draft_status: 'draft',
    })

    render(
      <SimpleAnswerEditor
        targetType="question"
        targetId="P3-001"
        initialDraft={draft}
        fallbackOriginalInput="교정 전 원문"
        fallbackInputLanguage="zh"
        userRepository={repository}
      />,
    )

    expect(screen.getByLabelText('내 답변')).toHaveValue('초안 전체 답변')
  })

  it('stores and updates one completed PracticeDraft without creating ReviewState', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(
      <SimpleAnswerEditor
        targetType="question"
        targetId="P3-001"
        userRepository={repository}
      />,
    )

    const editor = screen.getByLabelText('내 답변')
    await user.type(editor, '我周末运动。')
    await user.click(screen.getByRole('button', { name: '답변 저장' }))

    expect(await screen.findByRole('status')).toHaveTextContent('저장되었습니다.')
    await expect(
      repository.getPracticeDraftByTarget('question', 'P3-001'),
    ).resolves.toMatchObject({
      original_input: '我周末运动。',
      full_text: '我周末运动。',
      input_language: 'zh',
      completion_status: 'completed',
    })
    await expect(repository.listReviewStates()).resolves.toEqual([])

    await user.clear(editor)
    await user.type(editor, '저는 주말에 운동합니다.')
    await user.click(screen.getByRole('button', { name: '수정 저장' }))

    await waitFor(async () => {
      await expect(repository.listPracticeDrafts()).resolves.toHaveLength(1)
    })
    await expect(
      repository.getPracticeDraftByTarget('question', 'P3-001'),
    ).resolves.toMatchObject({
      original_input: '저는 주말에 운동합니다.',
      input_language: 'ko',
    })
    await expect(repository.listReviewStates()).resolves.toEqual([])
  })

  it('uses a UserAnswer original input when no PracticeDraft exists', () => {
    const repository = createRepository()
    render(
      <SimpleAnswerEditor
        targetType="question"
        targetId="P4-006"
        fallbackOriginalInput="교정 전에 내가 쓴 원문"
        fallbackInputLanguage="ko"
        userRepository={repository}
      />,
    )

    expect(screen.getByLabelText('내 답변')).toHaveValue(
      '교정 전에 내가 쓴 원문',
    )
    expect(screen.getByRole('button', { name: '답변 저장' })).toBeInTheDocument()
  })

  it('keeps the typed answer when persistence fails', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    const failingRepository: UserDataRepository = {
      ...repository,
      upsertPracticeDraft: async () => {
        throw new Error('write failed')
      },
    }
    render(
      <SimpleAnswerEditor
        targetType="visual_question"
        targetId="vq-P2-V01-Q1"
        userRepository={failingRepository}
      />,
    )

    await user.type(screen.getByLabelText('내 답변'), '他在跑步。')
    await user.click(screen.getByRole('button', { name: '답변 저장' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '답변을 저장하지 못했습니다',
    )
    expect(screen.getByLabelText('내 답변')).toHaveValue('他在跑步。')
  })
})
