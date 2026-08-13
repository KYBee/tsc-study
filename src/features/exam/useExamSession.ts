import { useCallback, useEffect, useReducer } from 'react'

import type { ExamConfig } from './examSession'
import { createExamState, examReducer } from './examSession'
import type { QuestionSpeechPlayer } from './questionSpeech'

interface UseExamSessionOptions {
  config: ExamConfig
  questionText: string
  speechPlayer: QuestionSpeechPlayer
  speechWatchdogMs?: number
}

export function useExamSession({
  config,
  questionText,
  speechPlayer,
  speechWatchdogMs = 8_000,
}: UseExamSessionOptions) {
  const [state, dispatch] = useReducer(examReducer, undefined, createExamState)

  useEffect(() => {
    if (state.phase !== 'preparing' && state.phase !== 'answering') return
    const timeoutId = window.setTimeout(() => dispatch({ type: 'TICK' }), 1_000)
    return () => window.clearTimeout(timeoutId)
  }, [state.phase, state.remainingSeconds, state.sessionNumber])

  useEffect(() => {
    if (state.phase !== 'playing_question') return
    let active = true
    let finished = false
    const finish = () => {
      if (!active || finished) return
      finished = true
      window.clearTimeout(watchdogId)
      dispatch({ type: 'QUESTION_FINISHED' })
    }
    const watchdogId = window.setTimeout(() => {
      speechPlayer.cancel()
      finish()
    }, speechWatchdogMs)
    speechPlayer.play(questionText, { onEnd: finish, onError: finish })

    return () => {
      active = false
      window.clearTimeout(watchdogId)
      speechPlayer.cancel()
    }
  }, [questionText, speechPlayer, speechWatchdogMs, state.phase, state.sessionNumber])

  useEffect(
    () => () => {
      speechPlayer.cancel()
    },
    [speechPlayer],
  )

  const start = useCallback(() => {
    speechPlayer.cancel()
    dispatch({ type: 'START', config })
  }, [config, speechPlayer])

  const reset = useCallback(() => {
    speechPlayer.cancel()
    dispatch({ type: 'RESET' })
  }, [speechPlayer])

  const replayQuestion = useCallback(() => {
    speechPlayer.cancel()
    speechPlayer.play(questionText, { onEnd: () => undefined, onError: () => undefined })
  }, [questionText, speechPlayer])

  return { state, start, reset, replayQuestion }
}
