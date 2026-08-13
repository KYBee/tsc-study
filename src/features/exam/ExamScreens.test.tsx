import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from '../../app/App'
import { createPublicContentRepository } from '../../data/publicContentRepository'
import {
  createUserDataRepository,
  type UserDataRepository,
} from '../../data/userDataRepository'
import { MockCorrectionProvider } from '../../providers/MockCorrectionProvider'
import type {
  QuestionSpeechCallbacks,
  QuestionSpeechPlayer,
} from './questionSpeech'

const repositories: UserDataRepository[] = []
let databaseSequence = 0

function renderExam(path: string, speechPlayer: QuestionSpeechPlayer) {
  const userRepository = createUserDataRepository({
    databaseName: `tsc-exam-screen-${databaseSequence++}`,
    now: () => '2026-08-13T12:00:00.000Z',
  })
  repositories.push(userRepository)
  const publicRepository = createPublicContentRepository()
  render(
    <App
      initialEntries={[path]}
      dependencies={{
        publicRepository,
        userRepository,
        correctionProvider: new MockCorrectionProvider(),
        questionSpeechPlayer: speechPlayer,
      }}
    />,
  )
  return { publicRepository, userRepository }
}

function advanceSeconds(seconds: number) {
  for (let index = 0; index < seconds; index += 1) {
    act(() => vi.advanceTimersByTime(1_000))
  }
}

afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  await Promise.all(repositories.splice(0).map((item) => item.destroy()))
})

describe('exam screens', () => {
  it('hides Part 2 question text until the 3 + 6 second exam finishes and advances to Q2', async () => {
    let speechCallbacks: QuestionSpeechCallbacks | undefined
    const speechPlayer: QuestionSpeechPlayer = {
      play: vi.fn((_text, callbacks) => {
        speechCallbacks = callbacks
      }),
      cancel: vi.fn(),
    }
    const { publicRepository } = renderExam(
      '/parts/2/sets/vs-P2-V01/exam',
      speechPlayer,
    )
    const question = await publicRepository.getVisualQuestionById('vq-P2-V01-Q1')
    expect(question).toBeDefined()
    const questionZh = question?.question_zh ?? ''
    expect(questionZh).not.toBe('')

    expect(await screen.findByRole('heading', { name: 'Part 2 실전 모드' })).toBeInTheDocument()
    expect(screen.getByText('질문 1 / 4')).toBeInTheDocument()
    expect(screen.queryByText(questionZh)).not.toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: '문제 시작' }))
    expect(screen.getByRole('timer')).toHaveTextContent('준비 3초')
    advanceSeconds(3)
    expect(speechPlayer.play).toHaveBeenCalledWith(
      questionZh,
      expect.any(Object),
    )
    expect(screen.getByText('질문 음성 재생 중')).toBeInTheDocument()

    act(() => speechCallbacks?.onEnd())
    expect(screen.getByRole('timer')).toHaveTextContent('답변 6초')
    advanceSeconds(6)
    expect(screen.getByText(questionZh)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '어느 정도 말함' }))
    vi.useRealTimers()
    expect(await screen.findByRole('status')).toHaveTextContent('회상 결과')
    fireEvent.click(screen.getByRole('button', { name: '다음 문제' }))
    expect(screen.getByText('질문 2 / 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '문제 시작' })).toBeInTheDocument()
  })

  it('hides Part 3 text through playback, 2 seconds of preparation, and 15 seconds of answering', async () => {
    let speechCallbacks: QuestionSpeechCallbacks | undefined
    const speechPlayer: QuestionSpeechPlayer = {
      play: vi.fn((_text, callbacks) => {
        speechCallbacks = callbacks
      }),
      cancel: vi.fn(),
    }
    const { publicRepository } = renderExam('/questions/P3-001/exam', speechPlayer)
    const question = await publicRepository.getQuestionById('P3-001')
    expect(question).toBeDefined()

    expect(await screen.findByRole('heading', { name: 'Part 3 실전 모드' })).toBeInTheDocument()
    expect(screen.queryByText(question!.question_zh)).not.toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: '문제 시작' }))
    expect(speechPlayer.play).toHaveBeenCalledWith(
      question!.question_zh,
      expect.any(Object),
    )
    act(() => speechCallbacks?.onEnd())
    expect(screen.getByRole('timer')).toHaveTextContent('준비 2초')
    advanceSeconds(2)
    expect(screen.getByRole('timer')).toHaveTextContent('답변 15초')
    advanceSeconds(15)
    expect(screen.getByText(question!.question_zh)).toBeInTheDocument()
  })
})
