import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PART2_EXAM_CONFIG } from './examSession'
import type { QuestionSpeechPlayer } from './questionSpeech'
import { useExamSession } from './useExamSession'

function Harness({ speechPlayer }: { speechPlayer: QuestionSpeechPlayer }) {
  const session = useExamSession({
    config: PART2_EXAM_CONFIG,
    questionText: '男的在做什么？',
    speechPlayer,
  })
  return (
    <div>
      <span>{session.state.phase}</span>
      <span>{session.state.remainingSeconds}</span>
      <button type="button" onClick={session.start}>start</button>
    </div>
  )
}

describe('useExamSession', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  const advanceSeconds = (seconds: number) => {
    for (let index = 0; index < seconds; index += 1) {
      act(() => vi.advanceTimersByTime(1_000))
    }
  }

  it('advances through timers and question playback', () => {
    const speechPlayer: QuestionSpeechPlayer = {
      play: vi.fn((_text, callbacks) => callbacks.onEnd()),
      cancel: vi.fn(),
    }
    render(<Harness speechPlayer={speechPlayer} />)

    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    expect(screen.getByText('preparing')).toBeInTheDocument()
    advanceSeconds(3)
    expect(speechPlayer.play).toHaveBeenCalledWith(
      '男的在做什么？',
      expect.objectContaining({ onEnd: expect.any(Function) }),
    )
    expect(screen.getByText('answering')).toBeInTheDocument()
    advanceSeconds(6)
    expect(screen.getByText('finished')).toBeInTheDocument()
  })

  it('uses the watchdog when speech never reports completion', () => {
    const speechPlayer: QuestionSpeechPlayer = {
      play: vi.fn(),
      cancel: vi.fn(),
    }
    render(<Harness speechPlayer={speechPlayer} />)

    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    advanceSeconds(3)
    expect(screen.getByText('playing_question')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(8_000))
    expect(speechPlayer.cancel).toHaveBeenCalled()
    expect(screen.getByText('answering')).toBeInTheDocument()
  })

  it('cancels speech and timers on unmount', () => {
    const speechPlayer: QuestionSpeechPlayer = {
      play: vi.fn(),
      cancel: vi.fn(),
    }
    const view = render(<Harness speechPlayer={speechPlayer} />)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    advanceSeconds(3)

    view.unmount()
    act(() => vi.advanceTimersByTime(30_000))
    expect(speechPlayer.cancel).toHaveBeenCalled()
  })
})
